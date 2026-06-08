from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from ..services import match_service
from ..services.state_service import get_state

router = APIRouter(prefix="/api/score", tags=["score"])


class ScoreDelta(BaseModel):
    delta: int


class PlayerName(BaseModel):
    name: str


class TurnPayload(BaseModel):
    current_turn: int


@router.post("/player/{player_number}")
def update_player_score(player_number: int, payload: ScoreDelta) -> dict:
    try:
        match_service.change_score(player_number, payload.delta)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_state()


@router.post("/undo")
def undo_score() -> dict:
    match_service.undo_last_score()
    return get_state()


@router.post("/reset")
def reset_score() -> dict:
    match_service.reset_score()
    return get_state()


@router.patch("/player/{player_number}/name")
def rename_player(player_number: int, payload: PlayerName) -> dict:
    try:
        match_service.rename_player(player_number, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_state()


@router.patch("/turn")
def set_turn(payload: TurnPayload) -> dict:
    try:
        match_service.set_turn(payload.current_turn)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_state()

