"""VoiceID endpoints: diarization, enrollment, verification."""
from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..models.database import AudioSession, EnrolledSpeaker, get_db
from ..services.audio_processor import preprocess_audio
from ..services.speaker_diarization import MATCH_THRESHOLD, cosine_similarity, embed_whole, identify_speakers
from ..services.speech_recognition import detect_speaker_languages
from ..utils.audio_utils import load_wav
from ..utils.file_handler import jsonable, safe_unlink, save_upload

router = APIRouter(prefix="/api/speakers", tags=["VoiceID"])


def enrolled_list(db: Session) -> list[dict]:
    return [{"id": e.id, "name": e.name, "embedding": e.vector()}
            for e in db.query(EnrolledSpeaker).filter(EnrolledSpeaker.consent.is_(True)).all()]


@router.post("")
async def speakers(file: UploadFile = File(...), num_speakers: int | None = Form(None),
                   detect_language: bool = Form(True), db: Session = Depends(get_db)):
    if num_speakers is not None and not (1 <= num_speakers <= 10):
        raise HTTPException(400, "num_speakers must be between 1 and 10")
    src = save_upload(file)
    try:
        prepared = await run_in_threadpool(preprocess_audio, src, False)
        result = await run_in_threadpool(identify_speakers, prepared.wav_path, num_speakers, enrolled_list(db))
        result.pop("_centroids", None)

        primary_lang = None
        if detect_language and result.get("speakers"):
            try:
                spk_langs = await run_in_threadpool(detect_speaker_languages, prepared.wav_path, result["speakers"])
                for stat in result.get("speaker_stats", []):
                    info = spk_langs.get(stat["speaker_id"])
                    if info:
                        stat["languages"] = [info["language"]]
                        stat["language_probability"] = info["probability"]
                        if primary_lang is None:
                            primary_lang = info["language"]
                for turn in result["speakers"]:
                    info = spk_langs.get(turn["speaker_id"])
                    if info:
                        turn["language"] = info["language"]
            except Exception as exc:
                result["language_error"] = str(exc)

        result["audio_url"] = f"/outputs/{prepared.wav_path.name}"
        sid = uuid.uuid4().hex[:16]
        db.add(AudioSession(id=sid, kind="speakers", title=f"{result['speaker_count']} speakers · {file.filename}",
                            filename=file.filename or "", audio_file=prepared.wav_path.name,
                            duration=result["duration"], language=primary_lang,
                            speaker_count=result["speaker_count"], result=jsonable(result)))
        db.commit()
        result["session_id"] = sid
        safe_unlink(prepared.raw_wav_path)
        return jsonable(result)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Speaker analysis failed: {exc}")
    finally:
        safe_unlink(src)


@router.post("/enroll")
async def enroll(file: UploadFile = File(...), name: str = Form(...), consent: bool = Form(False),
                 db: Session = Depends(get_db)):
    if not consent:
        raise HTTPException(400, "Enrollment requires the speaker's explicit consent.")
    name = name.strip()
    if not name:
        raise HTTPException(400, "Name is required.")
    src = save_upload(file)
    try:
        prepared = await run_in_threadpool(preprocess_audio, src, False)
        y, sr = load_wav(prepared.wav_path)
        emb = await run_in_threadpool(embed_whole, y, sr)
        rec = EnrolledSpeaker(name=name, embedding=json.dumps([round(float(v), 6) for v in emb]),
                              consent=True, sample_seconds=round(len(y) / sr, 2))
        db.add(rec)
        db.commit()
        safe_unlink(prepared.wav_path, prepared.raw_wav_path)  # keep only the embedding, not the voice
        return {"id": rec.id, "name": rec.name, "sample_seconds": rec.sample_seconds,
                "embedding_dim": len(emb), "note": "Only the 192-d embedding is stored; the audio was deleted."}
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    finally:
        safe_unlink(src)


@router.get("/enrolled")
def list_enrolled(db: Session = Depends(get_db)):
    return {"speakers": [{"id": e.id, "name": e.name, "sample_seconds": e.sample_seconds,
                          "created_at": e.created_at.isoformat()} for e in db.query(EnrolledSpeaker).all()],
            "match_threshold": MATCH_THRESHOLD}


@router.delete("/enrolled/{sid}")
def delete_enrolled(sid: int, db: Session = Depends(get_db)):
    e = db.get(EnrolledSpeaker, sid)
    if not e:
        raise HTTPException(404, "Not found")
    db.delete(e)
    db.commit()
    return {"deleted": sid}


@router.post("/verify")
async def verify(file_a: UploadFile = File(...), file_b: UploadFile = File(...)):
    """Speaker verification demo: cosine similarity of two recordings' ECAPA embeddings."""
    a, b = save_upload(file_a), save_upload(file_b)
    try:
        pa = await run_in_threadpool(preprocess_audio, a, False)
        pb = await run_in_threadpool(preprocess_audio, b, False)
        ya, sr = load_wav(pa.wav_path)
        yb, _ = load_wav(pb.wav_path)
        ea = await run_in_threadpool(embed_whole, ya, sr)
        eb = await run_in_threadpool(embed_whole, yb, sr)
        sim = cosine_similarity(ea, eb)
        safe_unlink(pa.wav_path, pa.raw_wav_path, pb.wav_path, pb.raw_wav_path)
        return {"cosine_similarity": round(sim, 4), "threshold": MATCH_THRESHOLD,
                "same_speaker_likely": sim >= MATCH_THRESHOLD,
                "note": "Similarity indicates similar voice characteristics; it is not proof of identity."}
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    finally:
        safe_unlink(a, b)
