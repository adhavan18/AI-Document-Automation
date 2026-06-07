"""
Shared mutable pipeline state — imported by both app.py and intelligence/router.py.
Avoids circular imports while letting the router report progress to the API layer.
"""
from __future__ import annotations
import threading

_lock = threading.Lock()
_active_case_id: str | None = None
_active_stage: int = 0   # 0=idle, 1-4=pipeline stage

def set_active(case_id: str | None, stage: int = 0) -> None:
    global _active_case_id, _active_stage
    with _lock:
        _active_case_id = case_id
        _active_stage = stage

def get_status() -> dict:
    with _lock:
        return {"active_case_id": _active_case_id, "active_stage": _active_stage}
