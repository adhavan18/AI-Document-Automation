"""
Lightweight, file-backed settings store.

Holds operator-tunable platform settings (currently the extraction confidence
threshold). Persisted to settings.json next to this module so it survives
restarts, and read live by the pipeline + review queue so a change in the
Settings page takes effect everywhere without a code change or migration.

The single source of truth is ``confidence_threshold`` stored as a 0–1 float.
The UI works in whole-percent (50–100); convert at the API boundary.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

_SETTINGS_PATH = Path(__file__).parent / "settings.json"
_LOCK = threading.Lock()

# Defaults — match the historical hardcoded thresholds.
_DEFAULTS: dict = {
    "confidence_threshold": 0.8,   # 0–1; fields below this need human review
    "watch_enabled": False,
    "watch_folder": "",
    "poll_interval_seconds": 60,
    "file_types": ["pdf"],
    "recurse": False,
    "move_after_ingestion": True,
}


def _read() -> dict:
    if _SETTINGS_PATH.exists():
        try:
            data = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                merged = dict(_DEFAULTS)
                merged.update(data)
                return merged
        except Exception:
            pass
    return dict(_DEFAULTS)


def get_settings() -> dict:
    """Return the full settings dict (with defaults filled in)."""
    return _read()


def get_threshold() -> float:
    """Return the confidence threshold as a 0–1 float (clamped to [0.5, 1.0])."""
    val = _read().get("confidence_threshold", _DEFAULTS["confidence_threshold"])
    try:
        f = float(val)
    except (TypeError, ValueError):
        f = _DEFAULTS["confidence_threshold"]
    return max(0.5, min(1.0, f))


def get_watch_config() -> dict:
    """Return only the watch-related settings keys (read live by the watcher thread)."""
    s = _read()
    return {
        "watch_enabled": bool(s.get("watch_enabled", False)),
        "watch_folder": str(s.get("watch_folder", "")),
        "poll_interval_seconds": int(s.get("poll_interval_seconds", 60)),
        "file_types": s.get("file_types", ["pdf"]),
        "recurse": bool(s.get("recurse", False)),
        "move_after_ingestion": bool(s.get("move_after_ingestion", True)),
    }


def update_settings(patch: dict) -> dict:
    """Merge *patch* into the stored settings and persist. Returns the new dict."""
    with _LOCK:
        current = _read()
        if "confidence_threshold" in patch and patch["confidence_threshold"] is not None:
            try:
                t = float(patch["confidence_threshold"])
                # accept either 0–1 or 0–100 and normalise to 0–1
                if t > 1.0:
                    t = t / 100.0
                current["confidence_threshold"] = max(0.5, min(1.0, t))
            except (TypeError, ValueError):
                pass
        if "watch_enabled" in patch:
            current["watch_enabled"] = bool(patch["watch_enabled"])
        if "watch_folder" in patch:
            current["watch_folder"] = str(patch["watch_folder"] or "")
        if "poll_interval_seconds" in patch:
            try:
                current["poll_interval_seconds"] = max(5, int(patch["poll_interval_seconds"]))
            except (TypeError, ValueError):
                pass
        if "file_types" in patch:
            ft = patch["file_types"]
            if isinstance(ft, list):
                current["file_types"] = [str(x).lower().lstrip(".") for x in ft if x]
            elif isinstance(ft, str):
                current["file_types"] = [ft.lower().lstrip(".")]
        if "recurse" in patch:
            current["recurse"] = bool(patch["recurse"])
        if "move_after_ingestion" in patch:
            current["move_after_ingestion"] = bool(patch["move_after_ingestion"])
        _SETTINGS_PATH.write_text(json.dumps(current, indent=2), encoding="utf-8")
        return current
