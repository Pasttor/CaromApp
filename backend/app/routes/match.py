from __future__ import annotations

from fastapi import APIRouter

from ..services import match_service
from ..services.state_service import get_state

router = APIRouter(prefix="/api/match", tags=["match"])


@router.get("/current")
def current_match() -> dict:
    return get_state()


@router.post("/start")
def start_match() -> dict:
    match_service.start_match()
    return get_state()


@router.post("/pause")
def pause_match() -> dict:
    match_service.pause_match()
    return get_state()


@router.post("/resume")
def resume_match() -> dict:
    match_service.resume_match()
    return get_state()


@router.post("/end")
def end_match() -> dict:
    summary = match_service.end_match()
    state = get_state()
    state["summary"] = match_service.serialize_match(summary)
    return state

