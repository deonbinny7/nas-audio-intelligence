"""Pydantic request/response models."""
from __future__ import annotations

from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: str = "en"
    gender: str = "female"
    rate: str = "+0%"


class TextTranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    target_language: str
    source_language: str | None = None


class TranslateResponse(BaseModel):
    session_id: str | None = None
    source_language: str
    source_language_probability: float | None = None
    target_language: str
    original_text: str
    translated_text: str
    audio_url: str | None = None
    input_audio_url: str | None = None
    voice: str | None = None
    segments: list[dict] = []
    timings: dict = {}
    tts_error: str | None = None


class SettingsUpdate(BaseModel):
    gemini_api_key: str | None = None
    hf_token: str | None = None
    gemini_model: str | None = None
    whisper_model: str | None = None
    diarization_backend: str | None = None
    noise_reduction: bool | None = None


class JobStatus(BaseModel):
    job_id: str
    status: str
    stage: str
    progress: float
    message: str = ""
    result_id: str | None = None
    error: str | None = None
