from __future__ import annotations

import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config
from .database import initialize_database
from .routes import match, replay, score, settings
from .services.state_bus import state_bus
from .services.state_service import get_state

initialize_database()

app = FastAPI(title="Billiard VAR Scoreboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(match.router)
app.include_router(score.router)
app.include_router(settings.router)
app.include_router(replay.router)

config.ensure_runtime_dirs()
app.mount("/media", StaticFiles(directory=config.VIDEO_DIR), name="media")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/state")
async def websocket_state(websocket: WebSocket) -> None:
    await state_bus.connect(websocket)
    try:
        await websocket.send_json(get_state())
        while True:
            await asyncio.sleep(1)
            await websocket.send_json(get_state())
    except WebSocketDisconnect:
        state_bus.disconnect(websocket)

