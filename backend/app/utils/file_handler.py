"""Upload handling: validation, unique naming, cleanup."""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from ..config import MAX_UPLOAD_MB, UPLOAD_DIR

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".aac", ".mp4", ".opus"}


def save_upload(file: UploadFile) -> Path:
    """Persist an uploaded audio file to backend/uploads and return its path."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No audio file was uploaded.")
    ext = Path(file.filename).suffix.lower() or ".webm"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    size_mb = dest.stat().st_size / (1024 * 1024)
    if size_mb == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if size_mb > MAX_UPLOAD_MB:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_MB} MB.")
    return dest


def safe_unlink(*paths: Path | str | None) -> None:
    for p in paths:
        if p:
            try:
                Path(p).unlink(missing_ok=True)
            except OSError:
                pass


def jsonable(obj):
    """Deep-convert numpy scalars/arrays so results can be stored as JSON."""
    import json

    import numpy as np

    def default(o):
        if isinstance(o, np.generic):
            return o.item()
        if isinstance(o, np.ndarray):
            return o.tolist()
        raise TypeError(f"Not serialisable: {type(o)}")

    return json.loads(json.dumps(obj, default=default))
