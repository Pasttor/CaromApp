from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import match_service
from ..services.state_service import get_state

router = APIRouter(prefix="/api/match", tags=["match"])


class StartMatchPayload(BaseModel):
    player_count: int = 2


@router.get("/current")
def current_match() -> dict:
    return get_state()


@router.post("/start")
def start_match(payload: StartMatchPayload) -> dict:
    try:
        match_service.start_match(payload.player_count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_state()


@router.post("/new-set")
def new_set() -> dict:
    match_service.new_set()
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
