from __future__ import annotations

from typing import Any

from . import match_service
from .settings_service import get_settings
from .video_service import video_service


def get_state(extra_video: dict[str, Any] | None = None) -> dict[str, Any]:
    match = match_service.get_current_match()
    latest_match = match_service.get_latest_match()
    return {
        "match": match_service.serialize_match(match),
        "latest_match": match_service.serialize_match(latest_match),
        "history": match_service.get_score_history(),
        "settings": get_settings(),
        "video": extra_video or video_service.status(),
    }

