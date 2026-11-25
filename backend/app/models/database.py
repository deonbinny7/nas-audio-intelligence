"""SQLite persistence (SQLAlchemy 2.0)."""
from __future__ import annotations

import datetime as dt
import json

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from ..config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class AudioSession(Base):
    """One processed recording (translation, speaker analysis or meeting)."""

    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))  # translate | speakers | meeting | transcribe
    title: Mapped[str] = mapped_column(String(255), default="Untitled")
    filename: Mapped[str] = mapped_column(String(255), default="")
    audio_file: Mapped[str] = mapped_column(String(255), default="")  # served from /outputs
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    speaker_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="done")
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EnrolledSpeaker(Base):
    """A consented voice-print for cross-meeting recognition."""

    __tablename__ = "enrolled_speakers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    embedding: Mapped[str] = mapped_column(Text)  # JSON list[float] (192-d ECAPA)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    sample_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_now)

    def vector(self) -> list[float]:
        return json.loads(self.embedding)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
