"""LinguaVoice endpoints: transcribe, translate, tts, languages."""
from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..config import LANGUAGE_NAMES, SUPPORTED_LANGUAGES
from ..models.database import AudioSession, get_db
from ..models.schemas import TextTranslateRequest, TranslateResponse, TTSRequest
from ..services.audio_processor import preprocess_audio
from ..services.gemini_client import GeminiNotConfigured
from ..services.speech_recognition import transcribe_audio
from ..services.text_to_speech import VOICES, synthesize
from ..services.translation import translate_text
from ..utils.file_handler import jsonable, safe_unlink, save_upload

router = APIRouter(prefix="/api", tags=["LinguaVoice"])


def _check_lang(code: str | None, field: str) -> None:
    if code and code not in LANGUAGE_NAMES:
        raise HTTPException(400, f"Unsupported {field} '{code}'. Use one of {list(LANGUAGE_NAMES)}")


@router.get("/languages")
def languages():
    return {"languages": [{**l, "tts_voices": VOICES.get(l["code"], {})} for l in SUPPORTED_LANGUAGES]}


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str | None = Form(None),
                     db: Session = Depends(get_db)):
    _check_lang(language, "language")
    src = save_upload(file)
    try:
        t0 = time.perf_counter()
        prepared = await run_in_threadpool(preprocess_audio, src)
        result = await run_in_threadpool(transcribe_audio, prepared.wav_path, language)
        result["preprocessing_time"] = round(time.perf_counter() - t0 - result["processing_time"], 2)
        result["input_audio_url"] = f"/outputs/{prepared.wav_path.name}"
        sid = uuid.uuid4().hex[:16]
        db.add(AudioSession(id=sid, kind="transcribe", title=(result["text"][:60] or "Transcription"),
                            filename=file.filename or "", audio_file=prepared.wav_path.name,
                            duration=result["duration"], language=result["language"], result=jsonable(result)))
        db.commit()
        result["session_id"] = sid
        safe_unlink(prepared.raw_wav_path)
        return jsonable(result)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))
    finally:
        safe_unlink(src)


@router.post("/translate", response_model=TranslateResponse)
async def translate(file: UploadFile = File(...), target_language: str = Form(...),
                    source_language: str | None = Form(None), gender: str = Form("female"),
                    generate_speech: bool = Form(True), db: Session = Depends(get_db)):
    """Audio -> Whisper ASR (+language ID) -> Gemini translation -> Edge TTS."""
    _check_lang(target_language, "target_language")
    _check_lang(source_language, "source_language")
    src = save_upload(file)
    timings: dict[str, float] = {}
    try:
        t = time.perf_counter()
        prepared = await run_in_threadpool(preprocess_audio, src)
        timings["preprocessing"] = round(time.perf_counter() - t, 2)
        asr = await run_in_threadpool(transcribe_audio, prepared.wav_path, source_language, False)
        timings["recognition"] = asr["processing_time"]
        if not asr["text"]:
            raise HTTPException(422, "No speech was recognised in the audio.")
        try:
            tr = await run_in_threadpool(translate_text, asr["text"], target_language, asr["language"])
        except GeminiNotConfigured as exc:
            raise HTTPException(503, str(exc))
        except Exception as exc:
            raise HTTPException(502, f"Gemini translation failed: {exc}")
        timings["translation"] = tr["processing_time"]
        audio_url = voice = tts_error = None
        if generate_speech:
            t = time.perf_counter()
            try:
                tts = await synthesize(tr["translated_text"], target_language, gender)
                audio_url, voice = tts["audio_url"], tts["voice"]
            except Exception as exc:
                tts_error = f"Edge TTS failed: {exc}"
            timings["speech_synthesis"] = round(time.perf_counter() - t, 2)
        timings["total"] = round(sum(timings.values()), 2)
        sid = uuid.uuid4().hex[:16]
        resp = TranslateResponse(
            session_id=sid, source_language=asr["language"],
            source_language_probability=asr["language_probability"], target_language=target_language,
            original_text=asr["text"], translated_text=tr["translated_text"], audio_url=audio_url,
            input_audio_url=f"/outputs/{prepared.wav_path.name}", voice=voice,
            segments=asr["segments"], timings=timings, tts_error=tts_error)
        db.add(AudioSession(id=sid, kind="translate", title=asr["text"][:60], filename=file.filename or "",
                            audio_file=prepared.wav_path.name, duration=asr["duration"],
                            language=asr["language"], result=jsonable(resp.model_dump())))
        db.commit()
        safe_unlink(prepared.raw_wav_path)
        return resp
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    finally:
        safe_unlink(src)


@router.post("/translate/text")
async def translate_text_only(req: TextTranslateRequest):
    _check_lang(req.target_language, "target_language")
    try:
        return await run_in_threadpool(translate_text, req.text, req.target_language, req.source_language)
    except GeminiNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Gemini translation failed: {exc}")


@router.post("/tts")
async def tts(req: TTSRequest):
    _check_lang(req.language, "language")
    try:
        return await synthesize(req.text, req.language, req.gender, req.rate)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Edge TTS failed: {exc}")
