"""Whisper ASR via faster-whisper (CTranslate2, CPU int8 by default)."""
from __future__ import annotations

import threading
import time
from pathlib import Path

from ..config import MODEL_DIR, settings

# Short native-script prompts: steer Whisper to the right script (e.g. Hindi in
# Devanagari rather than Urdu). Tested: a Malayalam prompt makes Whisper
# small hallucinate, so Malayalam is left unprompted (it may come out romanised).
SCRIPT_PROMPTS = {
    "hi": "नमस्ते, आज की बैठक शुरू करते हैं।",
    "ta": "வணக்கம், இன்றைய கூட்டத்தைத் தொடங்கலாம்.",
}

_model = None
_model_key: tuple | None = None
_lock = threading.Lock()


def get_model():
    global _model, _model_key
    key = (settings.whisper_model, settings.whisper_device, settings.whisper_compute_type)
    with _lock:
        if _model is None or _model_key != key:
            from faster_whisper import WhisperModel

            _model = WhisperModel(
                settings.whisper_model,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
                download_root=str(MODEL_DIR / "whisper"),
            )
            _model_key = key
        return _model


def unload_model() -> None:
    global _model, _model_key
    with _lock:
        _model, _model_key = None, None


def is_loaded() -> bool:
    return _model is not None


def transcribe_audio(wav_path, language: str | None = None, word_timestamps: bool = True) -> dict:
    """Run Whisper on a 16 kHz wav path or float32 numpy array.

    language=None -> automatic language detection (Whisper's language-ID head)."""
    model = get_model()
    if isinstance(wav_path, (str, Path)):
        # decode ourselves (16 kHz float32) instead of letting faster-whisper use PyAV
        from ..utils.audio_utils import load_wav

        wav_path, _ = load_wav(Path(wav_path))
    t0 = time.perf_counter()
    detected = None
    if not language:
        lang, prob, all_probs = model.detect_language(wav_path, vad_filter=True,
                                                      language_detection_segments=2)
        detected = (lang, prob, all_probs)
        language = lang
    segments, info = model.transcribe(
        wav_path,
        language=language,
        initial_prompt=SCRIPT_PROMPTS.get(language),
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        word_timestamps=word_timestamps,
        condition_on_previous_text=False,
    )
    out_segments = []
    for i, s in enumerate(segments):  # generator: decoding happens here
        words = []
        if word_timestamps and s.words:
            words = [{"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3),
                      "probability": round(w.probability, 3)} for w in s.words]
        out_segments.append({
            "id": i,
            "start": round(s.start, 3),
            "end": round(s.end, 3),
            "text": s.text.strip(),
            "avg_logprob": round(s.avg_logprob, 3),
            "no_speech_prob": round(s.no_speech_prob, 3),
            "words": words,
        })
    elapsed = time.perf_counter() - t0
    top_langs = []
    all_probs = detected[2] if detected else getattr(info, "all_language_probs", None)
    if all_probs:
        top_langs = [{"code": c, "probability": round(p, 4)} for c, p in all_probs[:5]]
    lang_prob = detected[1] if detected else info.language_probability
    return {
        "language": info.language,
        "language_probability": round(lang_prob, 4),
        "language_detected": detected is not None,
        "language_candidates": top_langs,
        "duration": round(info.duration, 3),
        "text": " ".join(s["text"] for s in out_segments).strip(),
        "segments": out_segments,
        "model": settings.whisper_model,
        "processing_time": round(elapsed, 2),
        "real_time_factor": round(elapsed / info.duration, 3) if info.duration else None,
    }


def transcribe_turns(y, sr: int, turns: list[dict], language: str | None = None,
                     max_chunk: float = 28.0, offset_pad: float = 0.15) -> dict:
    """Multilingual meeting mode: transcribe each speaker turn separately so every
    turn gets its own language detection (speaker 1 English, speaker 2 Malayalam ...)."""
    t0 = time.perf_counter()
    # merge consecutive turns of the same speaker (gap < 1 s) into chunks <= max_chunk
    chunks: list[dict] = []
    for t in sorted(turns, key=lambda t: t["start"]):
        if (chunks and chunks[-1]["speaker_id"] == t["speaker_id"] and t["start"] - chunks[-1]["end"] < 1.0
                and t["end"] - chunks[-1]["start"] <= max_chunk):
            chunks[-1]["end"] = t["end"]
        else:
            chunks.append({"speaker_id": t["speaker_id"], "start": t["start"], "end": t["end"]})
    segments, langs = [], {}
    for c in chunks:
        if c["end"] - c["start"] < 0.3:
            continue
        a = max(0, int((c["start"] - offset_pad) * sr))
        b = min(len(y), int((c["end"] + offset_pad) * sr))
        r = transcribe_audio(y[a:b], language=language, word_timestamps=False)
        off = a / sr
        for s in r["segments"]:
            if not s["text"]:
                continue
            segments.append({"id": len(segments), "start": round(s["start"] + off, 3),
                             "end": round(min(s["end"] + off, c["end"] + offset_pad), 3),
                             "text": s["text"], "speaker_id": c["speaker_id"],
                             "language": r["language"], "language_probability": r["language_probability"],
                             "overlap_ratio": 1.0, "uncertain": False, "avg_logprob": s["avg_logprob"]})
            langs[r["language"]] = langs.get(r["language"], 0.0) + (s["end"] - s["start"])
    total = len(y) / sr
    elapsed = time.perf_counter() - t0
    main = max(langs, key=langs.get) if langs else None
    return {"segments": segments, "language": main, "languages": langs, "duration": round(total, 3),
            "text": " ".join(s["text"] for s in segments), "model": settings.whisper_model,
            "processing_time": round(elapsed, 2),
            "real_time_factor": round(elapsed / total, 3) if total else None}


def detect_speaker_languages(wav_path: Path, turns: list[dict], max_seconds: float = 20.0) -> dict[str, dict]:
    """Identify the primary spoken language for each speaker using Whisper's language-ID head."""
    import numpy as np
    from ..utils.audio_utils import load_wav

    if not turns:
        return {}
    y, sr = load_wav(wav_path)
    model = get_model()
    by_speaker: dict[str, list[dict]] = {}
    for t in turns:
        by_speaker.setdefault(t["speaker_id"], []).append(t)

    out: dict[str, dict] = {}
    for sid, spk_turns in by_speaker.items():
        chunks = []
        total_samples = 0
        cap = int(max_seconds * sr)
        for t in spk_turns:
            a = max(0, int(t["start"] * sr))
            b = min(len(y), int(t["end"] * sr))
            if b - a < int(0.3 * sr):
                continue
            chunks.append(y[a:b])
            total_samples += b - a
            if total_samples >= cap:
                break
        if not chunks:
            continue
        clip = np.concatenate(chunks)[:cap]
        try:
            lang, prob, _ = model.detect_language(clip, vad_filter=True, language_detection_segments=1)
        except Exception:
            lang, prob, _ = model.detect_language(clip, vad_filter=False, language_detection_segments=1)
        if lang:
            out[sid] = {"language": lang, "probability": round(float(prob), 4)}
    return out
