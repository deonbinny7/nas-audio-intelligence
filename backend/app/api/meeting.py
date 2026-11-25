"""MeetingLens endpoints (background job + persisted results)."""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..config import LANGUAGE_NAMES
from ..models.database import AudioSession, SessionLocal, get_db
from ..services import jobs
from ..services.meeting_analyzer import generate_meeting_summary
from ..services.pipeline import build_report_markdown, process_meeting
from ..services.translation import translate_segments
from ..utils.file_handler import jsonable, safe_unlink, save_upload
from .speaker import enrolled_list

router = APIRouter(tags=["MeetingLens"])


def _get(db: Session, mid: str) -> AudioSession:
    m = db.get(AudioSession, mid)
    if not m or m.kind != "meeting":
        raise HTTPException(404, "Meeting not found")
    return m


def _public(m: AudioSession) -> dict:
    return {"id": m.id, "title": m.title, "filename": m.filename, "audio_url": f"/outputs/{m.audio_file}",
            "duration": m.duration, "language": m.language, "speaker_count": m.speaker_count,
            "created_at": m.created_at.isoformat(), **(m.result or {})}


@router.post("/api/meeting/analyze")
async def analyze(file: UploadFile = File(...), title: str = Form(""), num_speakers: int | None = Form(None),
                  language: str | None = Form(None), multilingual: bool = Form(True),
                  output_language: str = Form("en"), summarize: bool = Form(True)):
    if language and language not in LANGUAGE_NAMES:
        raise HTTPException(400, f"Unsupported language '{language}'")
    src = save_upload(file)
    jid = jobs.create_job("meeting")
    fname = file.filename or "recording"

    def work(progress) -> str:
        db = SessionLocal()
        try:
            result = process_meeting(Path(src), num_speakers=num_speakers, language=language,
                                     multilingual=multilingual, summarize=summarize,
                                     output_language=output_language, enrolled=enrolled_list(db),
                                     progress=progress)
            progress("saving", 0.95, "Saving meeting to history")
            mid = uuid.uuid4().hex[:16]
            ttl = title.strip() or (result.get("analysis") or {}).get("meeting_title") or Path(fname).stem
            db.add(AudioSession(id=mid, kind="meeting", title=ttl, filename=fname,
                                audio_file=result.pop("audio_file"), duration=result["duration"],
                                language=result.get("language"),
                                speaker_count=result["speakers"]["speaker_count"], result=jsonable(result)))
            db.commit()
            return mid
        finally:
            db.close()
            safe_unlink(src)

    jobs.submit(jid, work)
    return {"job_id": jid, "status": "queued"}


@router.get("/api/jobs/{jid}")
def job_status(jid: str):
    j = jobs.get(jid)
    if not j:
        raise HTTPException(404, "Job not found")
    return j


@router.websocket("/ws/jobs/{jid}")
async def job_ws(ws: WebSocket, jid: str):
    await ws.accept()
    last = ("", "", -1.0)
    try:
        while True:
            j = await jobs.wait_for_change(jid, last)
            if j is None:
                await ws.send_json({"error": "Job not found"})
                break
            last = (j["status"], j["stage"], j["progress"])
            await ws.send_json({k: v for k, v in j.items() if k != "events"})
            if j["status"] in ("done", "error"):
                break
    except WebSocketDisconnect:
        return
    await ws.close()


@router.get("/api/meeting/{mid}")
def get_meeting(mid: str, db: Session = Depends(get_db)):
    return _public(_get(db, mid))


@router.get("/api/meeting/{mid}/summary")
def get_summary(mid: str, db: Session = Depends(get_db)):
    m = _get(db, mid)
    return {"id": m.id, "analysis": m.result.get("analysis"), "analysis_error": m.result.get("analysis_error")}


@router.get("/api/meeting/{mid}/transcript")
def get_transcript(mid: str, db: Session = Depends(get_db)):
    m = _get(db, mid)
    return {"id": m.id, "transcript": m.result.get("transcript", []), "speakers": m.result.get("speakers")}


class TranslateBody(BaseModel):
    target_language: str = "en"


@router.post("/api/meeting/{mid}/translate")
async def translate_meeting(mid: str, body: TranslateBody, db: Session = Depends(get_db)):
    if body.target_language not in LANGUAGE_NAMES:
        raise HTTPException(400, "Unsupported language")
    m = _get(db, mid)
    segs = m.result.get("transcript", [])
    try:
        out = await run_in_threadpool(translate_segments, segs, body.target_language)
    except Exception as exc:
        raise HTTPException(502, f"Translation failed: {exc}")
    by_id = {o["id"]: o["translated_text"] for o in out}
    for s in segs:
        s["translation"] = by_id.get(s["id"], "")
    m.result["translation_language"] = body.target_language
    flag_modified(m, "result")
    db.commit()
    return {"id": mid, "target_language": body.target_language, "transcript": segs}


class SummarizeBody(BaseModel):
    output_language: str = "en"


@router.post("/api/meeting/{mid}/summarize")
async def resummarize(mid: str, body: SummarizeBody, db: Session = Depends(get_db)):
    m = _get(db, mid)
    try:
        a = await run_in_threadpool(generate_meeting_summary, m.result.get("transcript", []),
                                    LANGUAGE_NAMES.get(body.output_language, "English"))
    except Exception as exc:
        raise HTTPException(502, f"Analysis failed: {exc}")
    m.result["analysis"], m.result["analysis_error"] = a, None
    flag_modified(m, "result")
    db.commit()
    return {"id": mid, "analysis": a}


@router.get("/api/meeting/{mid}/report")
def report(mid: str, format: str = "md", db: Session = Depends(get_db)):
    m = _get(db, mid)
    md = build_report_markdown(m.title, m.created_at.strftime("%Y-%m-%d %H:%M UTC"), m.result)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in m.title)[:50] or "meeting"
    if format == "json":
        import json

        return Response(json.dumps(_public(m), ensure_ascii=False, indent=2), media_type="application/json",
                        headers={"Content-Disposition": f'attachment; filename="{safe}.json"'})
    if format == "html":
        return HTMLResponse(_html(m.title, md), headers={"Content-Disposition": f'attachment; filename="{safe}.html"'})
    return PlainTextResponse(md, media_type="text/markdown; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="{safe}.md"'})


def _html(title: str, md: str) -> str:
    """Minimal markdown -> printable HTML (print to PDF from the browser)."""
    import html
    import re

    out, in_table, in_list = [], False, False
    for line in md.splitlines():
        esc = html.escape(line.rstrip())
        esc = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", esc)
        esc = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<i>\1</i>", esc)
        esc = re.sub(r"\*(.+?)\*", r"<i>\1</i>", esc).replace("&amp;nbsp;", "&nbsp;")
        if line.startswith("|"):
            cells = [c.strip() for c in esc.strip("|").split("|")]
            if set("".join(cells)) <= set("-"):
                continue
            if not in_table:
                out.append("<table><tr>" + "".join(f"<th>{c}</th>" for c in cells) + "</tr>")
                in_table = True
            else:
                out.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>")
            continue
        if in_table:
            out.append("</table>"); in_table = False
        if line.startswith("- "):
            if not in_list:
                out.append("<ul>"); in_list = True
            out.append(f"<li>{esc[2:]}</li>")
            continue
        if in_list:
            out.append("</ul>"); in_list = False
        if line.startswith("## "):
            out.append(f"<h2>{esc[3:]}</h2>")
        elif line.startswith("# "):
            out.append(f"<h1>{esc[2:]}</h1>")
        elif line.strip():
            out.append(f"<p>{esc}</p>")
    if in_table:
        out.append("</table>")
    if in_list:
        out.append("</ul>")
    css = ("body{font-family:Segoe UI,Arial,sans-serif;max-width:860px;margin:40px auto;color:#111;line-height:1.5}"
           "h1{color:#1e3a8a}h2{border-bottom:2px solid #e5e7eb;padding-bottom:4px;margin-top:28px}"
           "table{border-collapse:collapse;width:100%}td,th{border:1px solid #d1d5db;padding:6px 8px;text-align:left}"
           "th{background:#f3f4f6}p{margin:6px 0}")
    return (f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
            f"<style>{css}</style></head><body>{''.join(out)}</body></html>")
