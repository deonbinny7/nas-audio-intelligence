"""Central configuration for the NAS backend. Values come from backend/.env."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE)

UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "pretrained_models"
for _d in (UPLOAD_DIR, OUTPUT_DIR, DATA_DIR, MODEL_DIR):
    _d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{(DATA_DIR / 'nas.db').as_posix()}"

SAMPLE_RATE = 16000
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))


class Settings:
    """Mutable runtime settings (the Settings page can change some of them)."""

    def __init__(self) -> None:
        self.reload()

    def reload(self) -> None:
        load_dotenv(ENV_FILE, override=True)
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
        self.hf_token: str = os.getenv("HF_TOKEN", "").strip()
        # tiny | base | small | medium. "small" is the tested default for an 8 GB laptop.
        self.whisper_model: str = os.getenv("WHISPER_MODEL", "small").strip()
        self.whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8").strip()
        self.whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu").strip()
        # auto -> pyannote when HF_TOKEN + pyannote installed, otherwise speechbrain
        self.diarization_backend: str = os.getenv("DIARIZATION_BACKEND", "auto").strip()
        self.noise_reduction: bool = os.getenv("NOISE_REDUCTION", "true").lower() == "true"
        self.cors_origins: list[str] = [
            o.strip()
            for o in os.getenv(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if o.strip()
        ]


settings = Settings()


def update_env_file(values: dict[str, str]) -> None:
    """Write/replace KEY=VALUE lines in backend/.env, then reload settings."""
    lines: list[str] = []
    if ENV_FILE.exists():
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    remaining = dict(values)
    out: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else None
        if key and key in remaining:
            out.append(f"{key}={remaining.pop(key)}")
        else:
            out.append(line)
    for k, v in remaining.items():
        out.append(f"{k}={v}")
    ENV_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")
    for k, v in values.items():
        os.environ[k] = v
    settings.reload()


SUPPORTED_LANGUAGES = [
    {"code": "en", "name": "English", "native": "English"},
    {"code": "ml", "name": "Malayalam", "native": "മലയാളം"},
    {"code": "hi", "name": "Hindi", "native": "हिन्दी"},
    {"code": "ta", "name": "Tamil", "native": "தமிழ்"},
    {"code": "kn", "name": "Kannada", "native": "ಕನ್ನಡ"},
    {"code": "te", "name": "Telugu", "native": "తెలుగు"},
    {"code": "fr", "name": "French", "native": "Français"},
    {"code": "es", "name": "Spanish", "native": "Español"},
]
LANGUAGE_NAMES = {l["code"]: l["name"] for l in SUPPORTED_LANGUAGES}
