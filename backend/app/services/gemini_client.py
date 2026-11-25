"""Thin wrapper around the google-genai SDK with structured JSON output.

GEMINI_API_KEY may hold several comma-separated keys: when one hits a quota /
rate limit / auth error, the next key is tried automatically.
"""
from __future__ import annotations

import json
import threading

from ..config import settings


class GeminiNotConfigured(RuntimeError):
    pass


_lock = threading.Lock()
_preferred = 0  # index of the key that last worked


def api_keys() -> list[str]:
    return [k.strip() for k in settings.gemini_api_key.split(",") if k.strip()]


def _retryable(exc: Exception) -> bool:
    msg = str(exc).lower()
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    return code in (401, 403, 429, 500, 503) or any(
        w in msg for w in ("quota", "rate", "exhausted", "api key", "permission", "unavailable", "overloaded"))


def generate_json(prompt: str, schema, temperature: float = 0.2):
    """Call Gemini and return a parsed object of `schema` (a Pydantic model)."""
    keys = api_keys()
    if not keys:
        raise GeminiNotConfigured("GEMINI_API_KEY is not set. Add it in Settings or backend/.env.")
    from google import genai
    from google.genai import types

    order = [(_preferred + i) % len(keys) for i in range(len(keys))]
    models = list(dict.fromkeys([settings.gemini_model, *FALLBACK_MODELS]))
    errors = []
    for model in models:
        result = _try_keys(prompt, schema, temperature, keys, order, model, errors)
        if result is not _NOT_FOUND:
            return result
    raise RuntimeError("Gemini call failed. " + " | ".join(errors))


_NOT_FOUND = object()
# tried in order if the configured model is retired / unavailable (404)
FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"]


def _try_keys(prompt, schema, temperature, keys, order, model, errors):
    global _preferred
    from google import genai
    from google.genai import types

    for idx in order:
        try:
            client = genai.Client(api_key=keys[idx])
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=temperature,
                ),
            )
            with _lock:
                _preferred = idx
            if getattr(resp, "parsed", None) is not None:
                return resp.parsed
            return schema.model_validate(json.loads(resp.text))
        except Exception as exc:
            errors.append(f"{model} key {idx + 1}: {str(exc)[:160]}")
            if "not_found" in str(exc).lower() or getattr(exc, "code", None) == 404:
                return _NOT_FOUND  # model unavailable: try next model
            if not _retryable(exc):
                raise
    return _NOT_FOUND
