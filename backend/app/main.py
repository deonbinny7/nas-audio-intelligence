"""NAS — Neural Audio System: unified FastAPI backend."""
from __future__ import annotations

import os

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from .api import history, meeting, speaker, translator  # noqa: E402
from .config import OUTPUT_DIR, settings  # noqa: E402
from .models.database import init_db  # noqa: E402

app = FastAPI(title="NAS — Neural Audio System",
              description="Multilingual speech intelligence: LinguaVoice, VoiceID and MeetingLens.",
              version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

init_db()
app.include_router(translator.router)
app.include_router(speaker.router)
app.include_router(meeting.router)
app.include_router(history.router)
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")


@app.get("/")
def root():
    return {"name": "NAS — Neural Audio System", "docs": "/docs", "health": "/api/health"}
