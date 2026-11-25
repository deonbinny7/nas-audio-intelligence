"""Audio preprocessing + classic speech-signal analysis (the DSP part of NAS).

preprocess_audio():  decode -> resample to 16 kHz mono -> (optional) spectral-gating
                     noise reduction -> peak normalisation.
analyze_audio():     framing + Hamming window + FFT -> spectrogram, mel spectrogram,
                     MFCC, energy-based VAD, and summary statistics for the UI.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

from ..config import OUTPUT_DIR, SAMPLE_RATE, settings
from ..utils.audio_utils import convert_to_wav, load_wav, probe_info

FRAME_LENGTH = 400  # 25 ms at 16 kHz
HOP_LENGTH = 160  # 10 ms at 16 kHz
N_FFT = 512


@dataclass
class PreparedAudio:
    original_path: Path
    wav_path: Path  # 16 kHz mono, normalised (and denoised if enabled)
    raw_wav_path: Path  # 16 kHz mono, before noise reduction
    duration: float
    sample_rate: int
    info: dict


def _normalize(y: np.ndarray, peak: float = 0.95) -> np.ndarray:
    m = float(np.max(np.abs(y))) if y.size else 0.0
    return y if m < 1e-8 else (y / m * peak).astype(np.float32)


def reduce_noise(y: np.ndarray, sr: int) -> np.ndarray:
    """Spectral-gating noise reduction (noisereduce). Falls back to no-op."""
    try:
        import noisereduce as nr

        return nr.reduce_noise(y=y, sr=sr, stationary=False, prop_decrease=0.8).astype(np.float32)
    except Exception:
        return y


def preprocess_audio(path: Path, denoise: bool | None = None) -> PreparedAudio:
    denoise = settings.noise_reduction if denoise is None else denoise
    info = probe_info(path)
    stem = uuid.uuid4().hex
    raw_wav = OUTPUT_DIR / f"{stem}_raw.wav"
    convert_to_wav(path, raw_wav)
    y, sr = load_wav(raw_wav)
    if y.size == 0:
        raise ValueError("The audio file contains no samples.")
    y = _normalize(y)
    sf.write(str(raw_wav), y, sr, subtype="PCM_16")
    clean = _normalize(reduce_noise(y, sr)) if denoise else y
    wav = OUTPUT_DIR / f"{stem}.wav"
    sf.write(str(wav), clean, sr, subtype="PCM_16")
    return PreparedAudio(path, wav, raw_wav, len(y) / sr, sr, info)


def _downsample_envelope(y: np.ndarray, points: int = 1200) -> list[list[float]]:
    """Min/max envelope for drawing a waveform cheaply in the browser."""
    if y.size == 0:
        return []
    chunk = max(1, len(y) // points)
    n = len(y) // chunk
    seg = y[: n * chunk].reshape(n, chunk)
    return [[round(float(a), 4), round(float(b), 4)] for a, b in zip(seg.min(1), seg.max(1))]


def _to_heatmap(mat_db: np.ndarray, max_cols: int = 400, unit: str = "dB") -> dict:
    """Compress a (freq x time) matrix to <= max_cols columns, scaled to 0..255."""
    if mat_db.shape[1] > max_cols:
        idx = np.linspace(0, mat_db.shape[1] - 1, max_cols).astype(int)
        mat_db = mat_db[:, idx]
    lo, hi = float(mat_db.min()), float(mat_db.max())
    scaled = np.zeros_like(mat_db) if hi - lo < 1e-9 else (mat_db - lo) / (hi - lo) * 255
    return {"rows": int(mat_db.shape[0]), "cols": int(mat_db.shape[1]),
            "min": round(lo, 2), "max": round(hi, 2), "unit": unit,
            "data": scaled.astype(np.uint8).tolist()}


def energy_vad(y: np.ndarray, sr: int, top_db: float = 35.0, min_dur: float = 0.25) -> list[dict]:
    """Voice activity detection from short-time energy (librosa.effects.split)."""
    import librosa

    intervals = librosa.effects.split(y, top_db=top_db, frame_length=FRAME_LENGTH * 2, hop_length=HOP_LENGTH)
    out = []
    for s, e in intervals:
        if (e - s) / sr >= min_dur:
            out.append({"start": round(s / sr, 3), "end": round(e / sr, 3)})
    return out


def analyze_audio(prepared: PreparedAudio) -> dict:
    import librosa

    raw, sr = load_wav(prepared.raw_wav_path)
    clean, _ = load_wav(prepared.wav_path)
    # Short-time Fourier transform with a Hamming window (25 ms frames, 10 ms hop)
    stft = librosa.stft(clean, n_fft=N_FFT, hop_length=HOP_LENGTH, win_length=FRAME_LENGTH, window="hamming")
    spec_db = librosa.amplitude_to_db(np.abs(stft), ref=np.max)
    mel = librosa.feature.melspectrogram(S=np.abs(stft) ** 2, sr=sr, n_mels=64)
    mel_db = librosa.power_to_db(mel, ref=np.max)
    mfcc = librosa.feature.mfcc(S=mel_db, n_mfcc=13)
    rms = librosa.feature.rms(y=clean, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
    zcr = librosa.feature.zero_crossing_rate(clean, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
    centroid = librosa.feature.spectral_centroid(S=np.abs(stft), sr=sr)[0]
    vad = energy_vad(clean, sr)
    speech_time = sum(v["end"] - v["start"] for v in vad)
    noise = raw - clean[: len(raw)] if len(clean) >= len(raw) else raw[: len(clean)] - clean
    snr = 10 * np.log10((np.mean(clean**2) + 1e-12) / (np.mean(noise**2) + 1e-12))
    n_frames = 1 + (len(clean) - FRAME_LENGTH) // HOP_LENGTH if len(clean) > FRAME_LENGTH else 1
    return {
        "duration": round(prepared.duration, 3),
        "sample_rate": sr,
        "original_sample_rate": prepared.info.get("original_sample_rate"),
        "channels": prepared.info.get("channels"),
        "format": prepared.info.get("format"),
        "frame_length_ms": FRAME_LENGTH / sr * 1000,
        "hop_length_ms": HOP_LENGTH / sr * 1000,
        "n_fft": N_FFT,
        "window": "hamming",
        "num_frames": int(n_frames),
        "rms_mean": round(float(rms.mean()), 5),
        "zcr_mean": round(float(zcr.mean()), 5),
        "spectral_centroid_mean_hz": round(float(centroid.mean()), 1),
        "estimated_noise_removed_db": round(float(snr), 2),
        "speech_ratio": round(speech_time / prepared.duration, 3) if prepared.duration else 0,
        "vad_segments": vad,
        "waveform_original": _downsample_envelope(raw),
        "waveform_denoised": _downsample_envelope(clean),
        "spectrogram": _to_heatmap(spec_db[: N_FFT // 4]),  # 0-4 kHz band, most speech energy
        "mel_spectrogram": _to_heatmap(mel_db),
        # each coefficient normalised (CMVN) so c1..c12 are visible next to the large c0
        "mfcc": _to_heatmap((mfcc - mfcc.mean(1, keepdims=True)) / (mfcc.std(1, keepdims=True) + 1e-9),
                            unit="z-score (CMVN)"),
    }
