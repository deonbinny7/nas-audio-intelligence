"""Align Whisper transcript segments with diarization turns by temporal overlap.

For each ASR segment we sum the overlap with every speaker's turns and pick the
speaker with the largest overlap. If the best overlap covers less than
MIN_OVERLAP_RATIO of the segment, the segment is labelled UNKNOWN. When word
timestamps exist, a segment that clearly spans a speaker change is split at
word boundaries first, so each sentence gets the right speaker.
"""
from __future__ import annotations

MIN_OVERLAP_RATIO = 0.3


def _overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def _best_speaker(start: float, end: float, turns: list[dict]) -> tuple[str, float]:
    dur = max(end - start, 1e-6)
    totals: dict[str, float] = {}
    for t in turns:
        ov = _overlap(start, end, t["start"], t["end"])
        if ov > 0:
            totals[t["speaker_id"]] = totals.get(t["speaker_id"], 0.0) + ov
    if not totals:
        # nothing overlaps: nearest turn within 0.5 s, still flagged uncertain
        near = min(turns, key=lambda t: min(abs(t["start"] - end), abs(t["end"] - start)), default=None)
        if near and min(abs(near["start"] - end), abs(near["end"] - start)) < 0.5:
            return near["speaker_id"], 0.0
        return "UNKNOWN", 0.0
    spk = max(totals, key=totals.get)
    ratio = totals[spk] / dur
    return (spk if ratio >= MIN_OVERLAP_RATIO else "UNKNOWN"), ratio


def _split_by_words(seg: dict, turns: list[dict]) -> list[dict]:
    words = seg.get("words") or []
    if len(words) < 2:
        return [seg]
    groups: list[tuple[str, list[dict]]] = []
    for w in words:
        spk, _ = _best_speaker(w["start"], max(w["end"], w["start"] + 0.05), turns)
        if groups and (groups[-1][0] == spk or spk == "UNKNOWN"):
            groups[-1][1].append(w)
        else:
            groups.append((spk, [w]))
    # merge tiny groups (< 2 words) into the previous one to avoid flicker
    merged: list[tuple[str, list[dict]]] = []
    for spk, ws in groups:
        if merged and len(ws) < 2:
            merged[-1][1].extend(ws)
        else:
            merged.append((spk, ws))
    if len(merged) == 1:
        return [seg]
    out = []
    for spk, ws in merged:
        out.append({**seg, "start": ws[0]["start"], "end": ws[-1]["end"],
                    "text": "".join(w["word"] for w in ws).strip(), "words": ws})
    return out


def assign_speakers(transcript_segments: list[dict], turns: list[dict]) -> list[dict]:
    aligned = []
    for seg in transcript_segments:
        for part in _split_by_words(seg, turns):
            spk, ratio = _best_speaker(part["start"], part["end"], turns)
            aligned.append({
                "id": len(aligned),
                "start": part["start"],
                "end": part["end"],
                "text": part["text"],
                "speaker_id": spk,
                "overlap_ratio": round(ratio, 3),
                "uncertain": spk == "UNKNOWN" or ratio < 0.6,
            })
    return aligned
