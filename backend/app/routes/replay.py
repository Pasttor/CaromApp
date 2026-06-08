from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..services.state_service import get_state
from ..services.video_service import video_service

router = APIRouter(tags=["video"])


@router.get("/api/video/status")
def video_status() -> dict:
    return get_state()


@router.post("/api/video/start")
def video_start() -> dict:
    return get_state(video_service.start())


@router.post("/api/video/stop")
def video_stop() -> dict:
    return get_state(video_service.stop())


@router.get("/api/replay/live")
def replay_live() -> dict:
    return get_state(video_service.live())


@router.get("/api/replay/last/{window}")
def replay_last(window: str) -> dict:
    try:
        replay = video_service.create_replay(window)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_state(replay)

