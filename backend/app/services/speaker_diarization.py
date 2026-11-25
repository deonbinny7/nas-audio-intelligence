"""VoiceID: speaker diarization and speaker embeddings.

Two back-ends:
  * pyannote  -> pretrained `pyannote/speaker-diarization-3.1` (needs HF_TOKEN and
                 accepting the model terms on huggingface.co).
  * speechbrain (default fallback, no token) ->
        energy VAD -> 1.5 s sliding windows -> ECAPA-TDNN embeddings (192-d)
        -> cosine-distance agglomerative clustering (speaker count chosen by
        silhouette score unless given) -> smoothing -> merged speaker turns.

In both cases ECAPA-TDNN centroids are computed per speaker so we can show the
speaker-similarity matrix and match against enrolled (consented) voices.
"""
from __future__ import annotations

import threading
import time
from pathlib import Path

import numpy as np

from ..config import MODEL_DIR, SAMPLE_RATE, settings
from ..utils.audio_utils import load_wav
from .audio_processor import energy_vad

WINDOW = 1.5  # seconds
STEP = 0.75  # seconds
MIN_REGION = 0.4  # ignore speech regions shorter than this
MAX_SPEAKERS = 8
MATCH_THRESHOLD = 0.55  # cosine similarity for enrolled-speaker match

_encoder = None
_pyannote = None
_lock = threading.Lock()
_last_error: dict[str, str] = {}


# ---------------------------------------------------------------- models
def get_encoder():
    global _encoder
    with _lock:
        if _encoder is None:
            from speechbrain.inference.speaker import EncoderClassifier

            kwargs = {"source": "speechbrain/spkrec-ecapa-voxceleb",
                      "savedir": str(MODEL_DIR / "spkrec-ecapa-voxceleb"),
                      "run_opts": {"device": "cpu"}}
            try:  # Windows: avoid symlink privilege errors
                from speechbrain.utils.fetching import LocalStrategy

                kwargs["local_strategy"] = LocalStrategy.COPY
            except Exception:
                pass
            _encoder = EncoderClassifier.from_hparams(**kwargs)
        return _encoder


def pyannote_installed() -> bool:
    try:
        import pyannote.audio  # noqa: F401

        return True
    except Exception:
        return False


def get_pyannote():
    global _pyannote
    with _lock:
        if _pyannote is None:
            from pyannote.audio import Pipeline

            name = "pyannote/speaker-diarization-3.1"
            try:
                _pyannote = Pipeline.from_pretrained(name, token=settings.hf_token)
            except TypeError:
                _pyannote = Pipeline.from_pretrained(name, use_auth_token=settings.hf_token)
            if _pyannote is None:
                raise RuntimeError("pyannote model could not be loaded. Accept the model terms on "
                                   "huggingface.co/pyannote/speaker-diarization-3.1 and "
                                   "huggingface.co/pyannote/segmentation-3.0")
        return _pyannote


def unload_models() -> None:
    global _encoder, _pyannote
    with _lock:
        _encoder, _pyannote = None, None


def backend_status() -> dict:
    wanted = settings.diarization_backend
    pa = pyannote_installed()
    if wanted == "speechbrain":
        active = "speechbrain"
    elif wanted == "pyannote":
        active = "pyannote"
    else:
        active = "pyannote" if (pa and settings.hf_token) else "speechbrain"
    return {"configured": wanted, "active": active, "pyannote_installed": pa,
            "hf_token_set": bool(settings.hf_token), "encoder_loaded": _encoder is not None,
            "pyannote_loaded": _pyannote is not None, "last_error": _last_error.get("pyannote")}


# ---------------------------------------------------------------- embeddings
def embed(chunks: list[np.ndarray], batch_size: int = 16) -> np.ndarray:
    """ECAPA-TDNN embeddings, L2-normalised, shape (n, 192)."""
    import torch

    enc = get_encoder()
    out = []
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i: i + batch_size]
        maxlen = max(len(c) for c in batch)
        wavs = np.zeros((len(batch), maxlen), dtype=np.float32)
        lens = np.zeros(len(batch), dtype=np.float32)
        for j, c in enumerate(batch):
            wavs[j, : len(c)] = c
            lens[j] = len(c) / maxlen
        with torch.no_grad():
            e = enc.encode_batch(torch.from_numpy(wavs), torch.from_numpy(lens)).squeeze(1).cpu().numpy()
        out.append(e)
    emb = np.concatenate(out, axis=0) if out else np.zeros((0, 192), dtype=np.float32)
    norms = np.linalg.norm(emb, axis=1, keepdims=True) + 1e-9
    return emb / norms


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def embed_whole(y: np.ndarray, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Single voice-print for enrollment: mean of window embeddings over speech."""
    regions = energy_vad(y, sr)
    chunks = []
    for r in regions:
        s, e = int(r["start"] * sr), int(r["end"] * sr)
        pos = s
        while pos < e:
            seg = y[pos: min(pos + int(3.0 * sr), e)]
            if len(seg) >= int(0.8 * sr):
                chunks.append(seg)
            pos += int(3.0 * sr)
    if not chunks:
        if len(y) < int(1.0 * sr):
            raise ValueError("Need at least ~1 second of speech to enroll a voice.")
        chunks = [y]
    emb = embed(chunks).mean(axis=0)
    return emb / (np.linalg.norm(emb) + 1e-9)


# ---------------------------------------------------------------- clustering
def _choose_k(emb: np.ndarray) -> tuple[int, dict]:
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score

    n = len(emb)
    if n < 4:
        return 1, {}
    scores = {}
    for k in range(2, min(MAX_SPEAKERS, n - 1) + 1):
        labels = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(emb)
        if len(set(labels)) < 2:
            continue
        scores[k] = float(silhouette_score(emb, labels, metric="cosine"))
    if not scores:
        return 1, scores
    best = max(scores, key=scores.get)
    # Single-speaker check: if all windows are very similar, call it one speaker.
    mean_sim = float((emb @ emb.T).mean())
    if scores[best] < 0.08 or mean_sim > 0.75:
        return 1, scores
    return best, scores


def _cluster(emb: np.ndarray, num_speakers: int | None) -> tuple[np.ndarray, dict]:
    from sklearn.cluster import AgglomerativeClustering

    if len(emb) == 0:
        return np.zeros(0, dtype=int), {}
    k, scores = (num_speakers, {}) if num_speakers else _choose_k(emb)
    k = max(1, min(k, len(emb)))
    if k == 1:
        return np.zeros(len(emb), dtype=int), scores
    labels = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(emb)
    return labels, scores


def _smooth(labels: np.ndarray, region_ids: np.ndarray) -> np.ndarray:
    """Median-like smoothing: a single window sandwiched between the same label flips."""
    out = labels.copy()
    for i in range(1, len(labels) - 1):
        if region_ids[i - 1] == region_ids[i] == region_ids[i + 1] and out[i - 1] == out[i + 1] != out[i]:
            out[i] = out[i - 1]
    return out


# ---------------------------------------------------------------- pipelines
def _merge_regions(regions: list[dict], max_gap: float = 0.5) -> list[dict]:
    out: list[dict] = []
    for r in regions:
        if out and r["start"] - out[-1]["end"] < max_gap:
            out[-1]["end"] = r["end"]
        else:
            out.append(dict(r))
    return out


def _absorb_short(segs: list[dict], min_dur: float = 0.6, max_gap: float = 0.6) -> list[dict]:
    """A very short turn glued to a neighbour of another speaker is usually a
    clustering error at a speaker boundary: give it to the closer neighbour."""
    changed = True
    while changed and len(segs) > 1:
        changed = False
        for i, s in enumerate(segs):
            if s["end"] - s["start"] >= min_dur:
                continue
            prev = segs[i - 1] if i > 0 else None
            nxt = segs[i + 1] if i + 1 < len(segs) else None
            gp = s["start"] - prev["end"] if prev else 1e9
            gn = nxt["start"] - s["end"] if nxt else 1e9
            target = prev if gp <= gn else nxt
            if target is None or min(gp, gn) > max_gap or target["_label"] == s["_label"]:
                continue
            target["start"], target["end"] = min(target["start"], s["start"]), max(target["end"], s["end"])
            target["_sims"] += s["_sims"]
            segs.pop(i)
            changed = True
            break
    # merge neighbours that now share a label
    merged: list[dict] = []
    for s in segs:
        if merged and merged[-1]["_label"] == s["_label"] and s["start"] - merged[-1]["end"] < 0.8:
            merged[-1]["end"] = max(merged[-1]["end"], s["end"])
            merged[-1]["_sims"] += s["_sims"]
        else:
            merged.append(s)
    return merged


def _windows(y: np.ndarray, sr: int):
    regions = [r for r in _merge_regions(energy_vad(y, sr, top_db=40, min_dur=0.15))
               if r["end"] - r["start"] >= MIN_REGION]
    wins = []  # (start, end, core_start, core_end, region_id)
    for rid, r in enumerate(regions):
        s, e = r["start"], r["end"]
        if e - s <= WINDOW:
            wins.append((s, e, s, e, rid))
            continue
        t = s
        while t < e:
            ws, we = t, min(t + WINDOW, e)
            if we - ws < WINDOW * 0.6:  # stretch the tail window back
                ws = max(s, we - WINDOW)
            c = (ws + we) / 2
            wins.append((ws, we, max(s, c - STEP / 2), min(e, c + STEP / 2), rid))
            if we >= e:
                break
            t += STEP
    # make cores contiguous inside each region
    fixed = []
    for i, w in enumerate(wins):
        cs = w[0] if (i == 0 or wins[i - 1][4] != w[4]) else fixed[-1][3]
        ce = w[1] if (i == len(wins) - 1 or wins[i + 1][4] != w[4]) else w[3]
        fixed.append((w[0], w[1], cs, max(cs, ce), w[4]))
    return regions, fixed


def _segments_from_windows(wins, labels, sims, max_gap: float = 0.35) -> list[dict]:
    segs: list[dict] = []
    for (ws, we, cs, ce, rid), lab, sim in zip(wins, labels, sims):
        if ce <= cs:
            continue
        if segs and segs[-1]["_label"] == lab and cs - segs[-1]["end"] <= max_gap:
            segs[-1]["end"] = ce
            segs[-1]["_sims"].append(sim)
        else:
            segs.append({"_label": int(lab), "start": cs, "end": ce, "_sims": [sim]})
    return segs


def _speechbrain_diarize(y: np.ndarray, sr: int, num_speakers: int | None):
    regions, wins = _windows(y, sr)
    if not wins:
        return [], np.zeros((0, 192)), np.zeros(0, dtype=int), {}, regions
    chunks = [y[int(w[0] * sr): int(w[1] * sr)] for w in wins]
    emb = embed(chunks)
    labels, scores = _cluster(emb, num_speakers)
    labels = _smooth(labels, np.array([w[4] for w in wins]))
    cents = {l: emb[labels == l].mean(0) for l in set(labels.tolist())}
    sims = [cosine_similarity(emb[i], cents[labels[i]]) for i in range(len(emb))]
    segs = _absorb_short(_segments_from_windows(wins, labels, sims, max_gap=0.8))
    return segs, emb, labels, {"silhouette_scores": scores, "num_windows": len(wins)}, regions


def _pyannote_diarize(wav_path: Path, y: np.ndarray, sr: int, num_speakers: int | None):
    import torch

    pipe = get_pyannote()
    kwargs = {"num_speakers": num_speakers} if num_speakers else {}
    # pass waveform in memory (avoids torchcodec/ffmpeg issues on Windows)
    result = pipe({"waveform": torch.from_numpy(y).unsqueeze(0), "sample_rate": sr}, **kwargs)
    annotation = getattr(result, "speaker_diarization", result)  # pyannote 4 vs 3
    raw = [(turn.start, turn.end, spk) for turn, _, spk in annotation.itertracks(yield_label=True)]
    names = sorted({r[2] for r in raw})
    label_of = {n: i for i, n in enumerate(names)}
    segs = [{"_label": label_of[s], "start": float(a), "end": float(b), "_sims": []}
            for a, b, s in raw if b - a > 0.05]
    # ECAPA centroids per speaker for similarity / enrollment matching
    chunks, labs = [], []
    for s in segs:
        a, b = int(s["start"] * sr), int(s["end"] * sr)
        if b - a >= int(0.5 * sr):
            chunks.append(y[a: min(b, a + int(6 * sr))])
            labs.append(s["_label"])
    emb = embed(chunks) if chunks else np.zeros((0, 192))
    return segs, emb, np.array(labs, dtype=int), {"pipeline": "pyannote/speaker-diarization-3.1"}, None


def identify_speakers(wav_path: Path, num_speakers: int | None = None,
                      enrolled: list[dict] | None = None) -> dict:
    """Full VoiceID run. Returns speaker turns, per-speaker stats and embeddings info."""
    t0 = time.perf_counter()
    y, sr = load_wav(wav_path)
    duration = len(y) / sr
    status = backend_status()
    backend = status["active"]
    fallback_reason = None
    if backend == "pyannote":
        try:
            segs, emb, labels, meta, regions = _pyannote_diarize(wav_path, y, sr, num_speakers)
            _last_error.pop("pyannote", None)
        except Exception as exc:  # graceful fallback
            _last_error["pyannote"] = str(exc)[:500]
            fallback_reason = f"pyannote unavailable ({str(exc)[:160]}); used SpeechBrain ECAPA clustering."
            backend = "speechbrain"
    if backend == "speechbrain":
        segs, emb, labels, meta, regions = _speechbrain_diarize(y, sr, num_speakers)

    # relabel by order of first appearance -> SPEAKER_00, SPEAKER_01 ...
    order: dict[int, int] = {}
    for s in sorted(segs, key=lambda s: s["start"]):
        order.setdefault(s["_label"], len(order))
    speakers_out = []
    for s in sorted(segs, key=lambda s: s["start"]):
        conf = round(float(np.mean(s["_sims"])), 3) if s["_sims"] else None
        speakers_out.append({"speaker_id": f"SPEAKER_{order[s['_label']]:02d}",
                             "start": round(s["start"], 3), "end": round(s["end"], 3),
                             "duration": round(s["end"] - s["start"], 3),
                             "confidence": conf})

    # centroids + similarity matrix + enrollment matching
    centroids: dict[str, np.ndarray] = {}
    for lab, idx in order.items():
        m = labels == lab
        if m.any():
            c = emb[m].mean(0)
            centroids[f"SPEAKER_{idx:02d}"] = c / (np.linalg.norm(c) + 1e-9)
    ids = sorted({s["speaker_id"] for s in speakers_out})
    sim_matrix = [[round(cosine_similarity(centroids[a], centroids[b]), 3)
                   if a in centroids and b in centroids else None for b in ids] for a in ids]

    stats = []
    total_speech = sum(s["duration"] for s in speakers_out) or 1.0
    for sid in ids:
        mine = [s for s in speakers_out if s["speaker_id"] == sid]
        talk = sum(s["duration"] for s in mine)
        match = None
        if enrolled and sid in centroids:
            best = max(((e, cosine_similarity(centroids[sid], np.asarray(e["embedding"])))
                        for e in enrolled), key=lambda x: x[1], default=(None, -1))
            if best[0] is not None:
                match = {"name": best[0]["name"], "enrolled_id": best[0]["id"],
                         "similarity": round(best[1], 3),
                         "matched": best[1] >= MATCH_THRESHOLD}
        stats.append({"speaker_id": sid, "total_duration": round(talk, 2),
                      "percentage": round(talk / total_speech * 100, 1),
                      "segment_count": len(mine),
                      "first_seen": mine[0]["start"], "last_seen": mine[-1]["end"],
                      "enrolled_match": match})

    # 2-D projection of window embeddings (PCA) for the embedding scatter plot
    projection = []
    if len(emb) >= 2:
        from sklearn.decomposition import PCA

        pts = PCA(n_components=2).fit_transform(emb)
        step = max(1, len(pts) // 300)
        inv = {lab: f"SPEAKER_{i:02d}" for lab, i in order.items()}
        projection = [{"x": round(float(p[0]), 4), "y": round(float(p[1]), 4),
                       "speaker_id": inv.get(int(l), "UNKNOWN")}
                      for p, l in list(zip(pts, labels))[::step]]

    return {
        "speakers": speakers_out,
        "speaker_count": len(ids),
        "speaker_stats": stats,
        "similarity_matrix": {"speaker_ids": ids, "matrix": sim_matrix},
        "embedding_projection": projection,
        "embedding_dim": int(emb.shape[1]) if emb.ndim == 2 and emb.size else 192,
        "backend": backend,
        "backend_note": fallback_reason,
        "meta": meta,
        "duration": round(duration, 3),
        "processing_time": round(time.perf_counter() - t0, 2),
        "confidence_note": ("Confidence = mean cosine similarity between a segment's ECAPA "
                            "embeddings and its speaker centroid." if backend == "speechbrain"
                            else "pyannote does not output per-segment confidence."),
        "_centroids": {k: v.tolist() for k, v in centroids.items()},
    }
