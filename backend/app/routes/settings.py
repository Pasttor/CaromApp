from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter

from ..services.settings_service import update_settings
from ..services.state_service import get_state

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    model_config = ConfigDict(extra="allow")


@router.get("")
def read_settings() -> dict:
    return get_state()


@router.put("")
def save_settings(payload: SettingsPayload) -> dict:
    update_settings(payload.model_dump())
    return get_state()

