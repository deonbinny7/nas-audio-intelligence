"""MeetingLens: structured meeting intelligence from a speaker-labelled transcript."""
from __future__ import annotations

import time

from pydantic import BaseModel, Field

from .gemini_client import generate_json


class ActionItem(BaseModel):
    task: str
    owner: str = Field(description="Speaker label (e.g. SPEAKER_01) or name ONLY if stated; else 'Unknown'")
    deadline: str = Field(description="Deadline exactly as mentioned; else 'Unknown'")
    evidence: str = Field(description="Short quote from the transcript supporting this item")


class Decision(BaseModel):
    decision: str
    evidence: str


class KeyPoint(BaseModel):
    point: str
    speaker: str = Field(description="Speaker label who raised it, or 'Unknown'")


class MeetingAnalysis(BaseModel):
    meeting_title: str
    summary: str
    key_points: list[KeyPoint]
    decisions: list[Decision]
    action_items: list[ActionItem]
    deadlines: list[str]
    topics: list[str]
    languages_spoken: list[str]
    sentiment: str = Field(description="Overall tone: positive, neutral, negative or mixed")
    missing_information: list[str] = Field(description="Things that are unclear or not stated in the transcript")


PROMPT = """You are MeetingLens, a careful meeting analyst.
Analyse the meeting transcript below. Lines are formatted:
[start-end] SPEAKER_ID (language): text
Lines may be in different languages (English, Malayalam, Hindi, Tamil, ...).
Write every output field in {out_lang}.

Strict rules:
- Use ONLY information present in the transcript. Do not invent people, names, decisions, tasks or deadlines.
- Refer to people by their speaker label (SPEAKER_00 ...) unless the transcript explicitly states a name.
- When an owner or deadline is not explicitly stated, use "Unknown".
- Lines from UNKNOWN speakers have uncertain attribution; do not assign tasks to them confidently.
- Every decision and action item must include a short supporting quote (evidence) copied from the transcript (translate the quote into {out_lang} if needed).
- If the transcript is too short or contains no decisions/actions, return empty lists rather than guessing.
- List anything ambiguous in missing_information.

TRANSCRIPT:
{transcript}
"""


def format_transcript(aligned: list[dict]) -> str:
    def ts(t: float) -> str:
        return f"{int(t // 60):02d}:{t % 60:04.1f}"

    return "\n".join(
        f"[{ts(s['start'])}-{ts(s['end'])}] {s['speaker_id']} ({s.get('language', '?')}): {s['text']}"
        for s in aligned if s["text"].strip()
    )


def generate_meeting_summary(aligned: list[dict], output_language: str = "English") -> dict:
    t0 = time.perf_counter()
    text = format_transcript(aligned)
    if not text.strip():
        raise ValueError("Transcript is empty; nothing to analyse.")
    result: MeetingAnalysis = generate_json(PROMPT.format(transcript=text, out_lang=output_language),
                                            MeetingAnalysis)
    data = result.model_dump() if hasattr(result, "model_dump") else dict(result)
    data["processing_time"] = round(time.perf_counter() - t0, 2)
    return data
