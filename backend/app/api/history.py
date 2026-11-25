"""History, dashboard stats, audio analysis panel, settings and health."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import SUPPORTED_LANGUAGES, settings, update_env_file
from ..models.database import AudioSession, EnrolledSpeaker, get_db
from ..models.schemas import SettingsUpdate
from ..services import speaker_diarization, speech_recognition
from ..services.audio_processor import analyze_audio, preprocess_audio
from ..utils.audio_utils import ffmpeg_available
from ..utils.file_handler import safe_unlink, save_upload

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/history")
def history(kind: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(AudioSession)
    if kind:
        q = q.filter(AudioSession.kind == kind)
    rows = q.order_by(AudioSession.created_at.desc()).limit(limit).all()
    return {"items": [{"id": r.id, "kind": r.kind, "title": r.title, "filename": r.filename,
                       "duration": r.duration, "language": r.language, "speaker_count": r.speaker_count,
                       "audio_url": f"/outputs/{r.audio_file}" if r.audio_file else None,
                       "created_at": r.created_at.isoformat()} for r in rows]}


@router.get("/history/{sid}")
def history_item(sid: str, db: Session = Depends(get_db)):
    r = db.get(AudioSession, sid)
    if not r:
        raise HTTPException(404, "Not found")
    return {"id": r.id, "kind": r.kind, "title": r.title, "filename": r.filename, "duration": r.duration,
            "language": r.language, "speaker_count": r.speaker_count, "created_at": r.created_at.isoformat(),
            "audio_url": f"/outputs/{r.audio_file}" if r.audio_file else None, "result": r.result}


@router.delete("/history/{sid}")
def delete_history(sid: str, db: Session = Depends(get_db)):
    from ..config import OUTPUT_DIR

    r = db.get(AudioSession, sid)
    if not r:
        raise HTTPException(404, "Not found")
    if r.audio_file:
        safe_unlink(OUTPUT_DIR / r.audio_file)
    db.delete(r)
    db.commit()
    return {"deleted": sid}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total = db.query(func.count(AudioSession.id)).scalar() or 0
    secs = db.query(func.coalesce(func.sum(AudioSession.duration), 0.0)).scalar() or 0.0
    speakers = db.query(func.coalesce(func.sum(AudioSession.speaker_count), 0)).scalar() or 0
    by_kind = dict(db.query(AudioSession.kind, func.count(AudioSession.id)).group_by(AudioSession.kind).all())
    langs = dict(db.query(AudioSession.language, func.count(AudioSession.id))
                 .filter(AudioSession.language.isnot(None)).group_by(AudioSession.language).all())
    recent = db.query(AudioSession).order_by(AudioSession.created_at.desc()).limit(6).all()
    # sessions per day for the activity chart
    per_day: dict[str, dict] = {}
    for r in db.query(AudioSession).order_by(AudioSession.created_at).all():
        d = r.created_at.strftime("%Y-%m-%d")
        e = per_day.setdefault(d, {"date": d, "sessions": 0, "minutes": 0.0})
        e["sessions"] += 1
        e["minutes"] = round(e["minutes"] + r.duration / 60, 2)
    return {"total_sessions": total, "audio_seconds": round(secs, 1), "speakers_identified": int(speakers),
            "languages_supported": len(SUPPORTED_LANGUAGES), "by_kind": by_kind, "languages": langs,
            "enrolled_speakers": db.query(func.count(EnrolledSpeaker.id)).scalar() or 0,
            "activity": list(per_day.values())[-14:],
            "recent": [{"id": r.id, "kind": r.kind, "title": r.title, "duration": r.duration,
                        "language": r.language, "speaker_count": r.speaker_count,
                        "created_at": r.created_at.isoformat()} for r in recent]}


@router.post("/audio/analyze")
async def audio_analysis(file: UploadFile = File(...)):
    """Speech-signal analysis panel: waveforms, spectrogram, mel, MFCC, VAD."""
    src = save_upload(file)
    try:
        prepared = await run_in_threadpool(preprocess_audio, src, True)
        out = await run_in_threadpool(analyze_audio, prepared)
        out["audio_url"] = f"/outputs/{prepared.wav_path.name}"
        out["original_audio_url"] = f"/outputs/{prepared.raw_wav_path.name}"
        return out
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))
    finally:
        safe_unlink(src)


def _mask(v: str) -> str:
    def one(k: str) -> str:
        return k[:4] + "…" + k[-4:] if len(k) > 10 else "set"

    return ", ".join(one(k.strip()) for k in v.split(",") if k.strip())


@router.get("/settings")
def get_settings():
    return {"gemini_api_key": _mask(settings.gemini_api_key), "gemini_key_set": bool(settings.gemini_api_key),
            "gemini_key_count": len([k for k in settings.gemini_api_key.split(",") if k.strip()]),
            "hf_token": _mask(settings.hf_token), "hf_token_set": bool(settings.hf_token),
            "gemini_model": settings.gemini_model, "whisper_model": settings.whisper_model,
            "whisper_compute_type": settings.whisper_compute_type,
            "diarization_backend": settings.diarization_backend, "noise_reduction": settings.noise_reduction}


@router.post("/settings")
def save_settings(body: SettingsUpdate):
    vals: dict[str, str] = {}
    if body.gemini_api_key is not None:
        vals["GEMINI_API_KEY"] = body.gemini_api_key.strip()
    if body.hf_token is not None:
        vals["HF_TOKEN"] = body.hf_token.strip()
    if body.gemini_model:
        vals["GEMINI_MODEL"] = body.gemini_model.strip()
    if body.whisper_model:
        if body.whisper_model not in {"tiny", "base", "small", "medium"}:
            raise HTTPException(400, "whisper_model must be tiny, base, small or medium")
        vals["WHISPER_MODEL"] = body.whisper_model
    if body.diarization_backend:
        if body.diarization_backend not in {"auto", "pyannote", "speechbrain"}:
            raise HTTPException(400, "diarization_backend must be auto, pyannote or speechbrain")
        vals["DIARIZATION_BACKEND"] = body.diarization_backend
    if body.noise_reduction is not None:
        vals["NOISE_REDUCTION"] = "true" if body.noise_reduction else "false"
    if vals:
        update_env_file(vals)
        if "HF_TOKEN" in vals or "DIARIZATION_BACKEND" in vals:
            speaker_diarization.unload_models()
    return get_settings()


@router.post("/system/unload")
def unload():
    """Free RAM: unload Whisper and speaker models (they reload on next use)."""
    speech_recognition.unload_model()
    speaker_diarization.unload_models()
    import gc

    gc.collect()
    return {"unloaded": True}


@router.get("/health")
def health():
    return {"status": "ok", "ffmpeg": ffmpeg_available(),
            "gemini_key_set": bool(settings.gemini_api_key), "hf_token_set": bool(settings.hf_token),
            "whisper": {"model": settings.whisper_model, "compute_type": settings.whisper_compute_type,
                        "loaded": speech_recognition.is_loaded()},
            "diarization": speaker_diarization.backend_status()}
