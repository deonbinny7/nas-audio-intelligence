"""Evaluation metrics for the report: WER (ASR) and DER (diarization)."""
from __future__ import annotations

import unicodedata

import numpy as np


def _normalize(text: str) -> list[str]:
    """Lower-case and drop punctuation (incl. the Devanagari danda) before scoring."""
    cleaned = "".join(" " if unicodedata.category(c).startswith("P") or c in "।॥" else c for c in text.lower())
    return cleaned.split()


def wer(reference: str, hypothesis: str) -> dict:
    """Word Error Rate = (S + D + I) / N via Levenshtein alignment on words."""
    r, h = _normalize(reference), _normalize(hypothesis)
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=int)
    d[:, 0] = np.arange(len(r) + 1)
    d[0, :] = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + cost)
    return {"wer": round(d[-1, -1] / max(1, len(r)), 4), "errors": int(d[-1, -1]), "ref_words": len(r)}


def der(reference: list[dict], hypothesis: list[dict], collar: float = 0.25, step: float = 0.01) -> dict:
    """Frame-based Diarization Error Rate with optimal speaker mapping.

    reference/hypothesis: [{"speaker_id", "start", "end"}]. Frames within `collar`
    seconds of a reference boundary are not scored (standard NIST practice).
    DER = (missed speech + false alarm + speaker confusion) / total reference speech.
    """
    from scipy.optimize import linear_sum_assignment

    end = max([s["end"] for s in reference + hypothesis] + [0])
    n = int(np.ceil(end / step)) + 1
    t = np.arange(n) * step
    ref_ids = sorted({s["speaker_id"] for s in reference})
    hyp_ids = sorted({s["speaker_id"] for s in hypothesis})
    R = np.zeros((len(ref_ids), n), bool)
    H = np.zeros((len(hyp_ids), n), bool)
    for s in reference:
        R[ref_ids.index(s["speaker_id"]), (t >= s["start"]) & (t < s["end"])] = True
    for s in hypothesis:
        H[hyp_ids.index(s["speaker_id"]), (t >= s["start"]) & (t < s["end"])] = True
    scored = np.ones(n, bool)
    for s in reference:
        for b in (s["start"], s["end"]):
            scored &= ~((t > b - collar) & (t < b + collar))
    R, H = R[:, scored], H[:, scored]
    # optimal 1:1 mapping hyp -> ref maximising overlap
    overlap = np.array([[np.sum(R[i] & H[j]) for j in range(len(hyp_ids))] for i in range(len(ref_ids))])
    mapping = {}
    if overlap.size:
        ri, hj = linear_sum_assignment(-overlap)
        mapping = {hyp_ids[j]: ref_ids[i] for i, j in zip(ri, hj)}
    n_ref = R.sum(0)
    n_hyp = H.sum(0)
    total = n_ref.sum()
    miss = np.maximum(n_ref - n_hyp, 0).sum()
    fa = np.maximum(n_hyp - n_ref, 0).sum()
    correct = np.zeros(R.shape[1], int)
    for hid, rid in mapping.items():
        correct += (H[hyp_ids.index(hid)] & R[ref_ids.index(rid)])
    conf = (np.minimum(n_ref, n_hyp) - correct).sum()
    return {"der": round(float((miss + fa + conf) / max(total, 1)), 4),
            "missed_speech": round(float(miss / max(total, 1)), 4),
            "false_alarm": round(float(fa / max(total, 1)), 4),
            "speaker_confusion": round(float(conf / max(total, 1)), 4),
            "mapping": mapping, "collar": collar}
