from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("CAROM_DATA_DIR", PROJECT_ROOT / "data"))
DB_PATH = Path(os.getenv("CAROM_DB_PATH", DATA_DIR / "carom.sqlite3"))
VIDEO_DIR = Path(os.getenv("CAROM_VIDEO_DIR", DATA_DIR / "video"))
LIVE_DIR = VIDEO_DIR / "live"
REPLAY_DIR = VIDEO_DIR / "replay"
LOG_DIR = DATA_DIR / "logs"

DEFAULT_SETTINGS: dict[str, str] = {
    "hourly_rate_mxn": "120",
    "camera_source_type": "usb",
    "camera_device": "default",
    "demo_mode_enabled": "true",
    "buffer_minutes": "30",
    "segment_seconds": "5",
    "video_resolution": "1280x720",
    "video_fps": "30",
    "allow_negative_scores": "false",
}

REPLAY_WINDOWS_SECONDS = {
    "30s": 30,
    "1m": 60,
    "5m": 300,
    "30m": 1800,
}


def ensure_runtime_dirs() -> None:
    for path in (DATA_DIR, VIDEO_DIR, LIVE_DIR, REPLAY_DIR, LOG_DIR):
        path.mkdir(parents=True, exist_ok=True)

