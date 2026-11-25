"""Evaluate NAS on your own test recordings: WER (ASR) and DER (diarization).

Usage (from NAS/backend with the venv active):
    python ../scripts/evaluate.py wer  <audio>  "<reference transcript>"  [--lang hi]
    python ../scripts/evaluate.py der  <audio>  <reference.csv>  [--speakers 3]

reference.csv rows: speaker,start,end   (seconds, e.g. A,0.0,4.2)
Report the numbers you get with the exact test conditions (mic, room, language,
model size). Do not report numbers you did not measure.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.services.audio_processor import preprocess_audio  # noqa: E402
from app.services.speaker_diarization import identify_speakers  # noqa: E402
from app.services.speech_recognition import transcribe_audio  # noqa: E402
from app.utils.metrics import der, wer  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("metric", choices=["wer", "der"])
    ap.add_argument("audio")
    ap.add_argument("reference")
    ap.add_argument("--lang", default=None)
    ap.add_argument("--speakers", type=int, default=None)
    a = ap.parse_args()
    prepared = preprocess_audio(Path(a.audio))
    if a.metric == "wer":
        r = transcribe_audio(prepared.wav_path, a.lang)
        print("Hypothesis:", r["text"])
        print(json.dumps({"language": r["language"], **wer(a.reference, r["text"])}, indent=2))
    else:
        ref = [{"speaker_id": row[0], "start": float(row[1]), "end": float(row[2])}
               for row in csv.reader(open(a.reference, encoding="utf-8")) if row and not row[0].startswith("#")]
        r = identify_speakers(prepared.raw_wav_path, a.speakers)
        print(json.dumps({"speakers_found": r["speaker_count"], **der(ref, r["speakers"])}, indent=2))


if __name__ == "__main__":
    main()
