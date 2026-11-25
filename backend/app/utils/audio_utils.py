"""Low-level audio helpers: decoding any format to 16 kHz mono via FFmpeg."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

from ..config import SAMPLE_RATE


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def probe_info(path: Path) -> dict:
    """Original file properties (sample rate, channels) before resampling."""
    try:
        info = sf.info(str(path))
        return {"original_sample_rate": info.samplerate, "channels": info.channels,
                "format": info.format, "subtype": info.subtype}
    except Exception:
        pass
    if ffmpeg_available():
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                 "stream=sample_rate,channels,codec_name", "-of", "default=nw=1", str(path)],
                capture_output=True, text=True, timeout=30,
            ).stdout
            kv = dict(line.split("=", 1) for line in out.strip().splitlines() if "=" in line)
            return {"original_sample_rate": int(kv.get("sample_rate", 0) or 0),
                    "channels": int(kv.get("channels", 0) or 0),
                    "format": kv.get("codec_name", "unknown"), "subtype": None}
        except Exception:
            pass
    return {"original_sample_rate": None, "channels": None, "format": None, "subtype": None}


def convert_to_wav(src: Path, dest: Path, sr: int = SAMPLE_RATE) -> Path:
    """Decode any audio/video container into 16-bit PCM mono WAV at `sr` Hz."""
    if ffmpeg_available():
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
               "-ac", "1", "-ar", str(sr), "-c:a", "pcm_s16le", str(dest)]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"FFmpeg could not decode the audio: {res.stderr.strip()[:300]}")
        return dest
    # Fallback without FFmpeg: librosa can read wav/flac/ogg (not m4a/webm/mp3 reliably)
    import librosa

    y, _ = librosa.load(str(src), sr=sr, mono=True)
    sf.write(str(dest), y, sr, subtype="PCM_16")
    return dest


def load_wav(path: Path) -> tuple[np.ndarray, int]:
    y, sr = sf.read(str(path), dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)
    return y, sr
