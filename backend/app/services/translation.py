"""LinguaVoice translation via Gemini (operates on the recognised transcript)."""
from __future__ import annotations

import time

from pydantic import BaseModel

from ..config import LANGUAGE_NAMES
from .gemini_client import generate_json


class _Translation(BaseModel):
    translated_text: str


class _Item(BaseModel):
    id: int
    translated_text: str


class _Batch(BaseModel):
    items: list[_Item]


def _lang(code: str | None) -> str:
    return LANGUAGE_NAMES.get(code or "", code or "the detected language")


def translate_text(text: str, target: str, source: str | None = None) -> dict:
    t0 = time.perf_counter()
    if not text.strip():
        return {"translated_text": "", "processing_time": 0.0}
    prompt = (
        f"Translate the following {_lang(source)} text into {_lang(target)}.\n"
        "Rules: translate faithfully and naturally; keep names, numbers and dates; "
        "do not add explanations, notes or transliterations; if the text is already in the "
        f"target language, return it unchanged. Use the native script of {_lang(target)}.\n\n"
        f"TEXT:\n{text}"
    )
    out = generate_json(prompt, _Translation)
    return {"translated_text": out.translated_text.strip(), "processing_time": round(time.perf_counter() - t0, 2)}


def translate_segments(segments: list[dict], target: str) -> list[dict]:
    """Translate many transcript lines in one call, preserving ids/order."""
    if not segments:
        return []
    lines = "\n".join(f'{s["id"]}\t{s["text"]}' for s in segments)
    prompt = (
        f"Translate each line of this multilingual meeting transcript into {_lang(target)}. "
        "Each line is '<id>\\t<text>'. Lines may be in different source languages. "
        "Return one item per id with the faithful translation. Do not merge, drop or invent lines. "
        f"Use the native script of {_lang(target)}.\n\n{lines}"
    )
    out = generate_json(prompt, _Batch)
    by_id = {i.id: i.translated_text for i in out.items}
    return [{"id": s["id"], "translated_text": by_id.get(s["id"], "")} for s in segments]
