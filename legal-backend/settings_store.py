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
    "confidence_threshold": 0.7,   # 0–1; fields below this need human review
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
        _SETTINGS_PATH.write_text(json.dumps(current, indent=2), encoding="utf-8")
        return current
