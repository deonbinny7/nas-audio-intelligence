"""Neural TTS with Microsoft Edge voices (edge-tts)."""
from __future__ import annotations

import os
import ssl
import uuid

from ..config import OUTPUT_DIR

VOICES = {
    "en": {"female": "en-US-AriaNeural", "male": "en-US-GuyNeural"},
    "ml": {"female": "ml-IN-SobhanaNeural", "male": "ml-IN-MidhunNeural"},
    "hi": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
    "ta": {"female": "ta-IN-PallaviNeural", "male": "ta-IN-ValluvarNeural"},
    "kn": {"female": "kn-IN-SapnaNeural", "male": "kn-IN-GaganNeural"},
    "te": {"female": "te-IN-ShrutiNeural", "male": "te-IN-MohanNeural"},
    "fr": {"female": "fr-FR-DeniseNeural", "male": "fr-FR-HenriNeural"},
    "es": {"female": "es-ES-ElviraNeural", "male": "es-ES-AlvaroNeural"},
}


async def synthesize(text: str, language: str, gender: str = "female", rate: str = "+0%") -> dict:
    import edge_tts

    proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy") or None
    ca = os.getenv("SSL_CERT_FILE")
    if ca and os.path.exists(ca):  # corporate/college proxies with their own CA
        import edge_tts.communicate as _c

        _c._SSL_CTX = ssl.create_default_context(cafile=ca)

    if not text.strip():
        raise ValueError("No text to synthesise.")
    voice = VOICES.get(language, VOICES["en"]).get(gender, VOICES.get(language, VOICES["en"])["female"])
    name = f"tts_{uuid.uuid4().hex[:12]}.mp3"
    path = OUTPUT_DIR / name
    last_exc: Exception | None = None
    for _ in range(3):  # the Edge endpoint occasionally returns no audio; retry
        try:
            await edge_tts.Communicate(text, voice, rate=rate, proxy=proxy).save(str(path))
            last_exc = None
            break
        except Exception as exc:
            last_exc = exc
    if last_exc:
        raise last_exc
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError("Edge TTS returned no audio.")
    return {"audio_url": f"/outputs/{name}", "voice": voice, "file": name}
