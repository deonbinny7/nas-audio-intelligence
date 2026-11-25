"""Tiny in-process background job manager (thread pool) with progress events."""
from __future__ import annotations

import asyncio
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

# one worker: an 8 GB laptop should never run two model pipelines at once
_executor = ThreadPoolExecutor(max_workers=1)
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def create_job(kind: str) -> str:
    jid = uuid.uuid4().hex[:16]
    with _lock:
        _jobs[jid] = {"job_id": jid, "kind": kind, "status": "queued", "stage": "queued",
                      "progress": 0.0, "message": "Waiting in queue", "result_id": None, "error": None,
                      "events": []}
    return jid


def update(jid: str, stage: str, progress: float, message: str = "") -> None:
    with _lock:
        j = _jobs.get(jid)
        if j:
            j.update(status="running", stage=stage, progress=round(progress, 3), message=message)
            j["events"].append({"stage": stage, "progress": round(progress, 3), "message": message})


def get(jid: str) -> dict | None:
    with _lock:
        j = _jobs.get(jid)
        return {k: v for k, v in j.items() if k != "events"} | {"events": list(j["events"])} if j else None


def submit(jid: str, fn: Callable[[Callable[[str, float, str], None]], str]) -> None:
    def run():
        try:
            result_id = fn(lambda s, p, m="": update(jid, s, p, m))
            with _lock:
                _jobs[jid].update(status="done", stage="done", progress=1.0,
                                  message="Completed", result_id=result_id)
        except Exception as exc:  # surface error to the UI
            traceback.print_exc()
            with _lock:
                _jobs[jid].update(status="error", stage="error", error=str(exc), message=str(exc))

    _executor.submit(run)


async def wait_for_change(jid: str, last: tuple, timeout: float = 15.0) -> dict | None:
    """Used by the WebSocket endpoint to push updates."""
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    while loop.time() < end:
        j = get(jid)
        if j is None:
            return None
        if (j["status"], j["stage"], j["progress"]) != last:
            return j
        await asyncio.sleep(0.4)
    return get(jid)
