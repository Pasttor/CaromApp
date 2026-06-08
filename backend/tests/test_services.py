from __future__ import annotations

from datetime import timedelta

import pytest

from app import config
from app.database import db, initialize_database
from app.services import match_service
from app.services.settings_service import update_settings
from app.services.video_service import video_service


@pytest.fixture()
def runtime(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.sqlite3")
    monkeypatch.setattr(config, "VIDEO_DIR", tmp_path / "video")
    monkeypatch.setattr(config, "LIVE_DIR", tmp_path / "video" / "live")
    monkeypatch.setattr(config, "REPLAY_DIR", tmp_path / "video" / "replay")
    monkeypatch.setattr(config, "LOG_DIR", tmp_path / "logs")
    initialize_database()
    yield tmp_path


def test_score_changes_clamp_and_undo(runtime):
    match_service.start_match()

    match = match_service.change_score(1, 3)
    assert match["player_1_score"] == 3

    match = match_service.change_score(1, -10)
    assert match["player_1_score"] == 0

    match = match_service.undo_last_score()
    assert match is not None
    assert match["player_1_score"] == 3


def test_timer_cost_uses_active_duration(runtime):
    update_settings({"hourly_rate_mxn": 120})
    match = match_service.start_match()
    started_at = (match_service.utc_now() - timedelta(hours=1)).isoformat()

    with db() as connection:
        connection.execute(
            "UPDATE matches SET started_at = ?, hourly_rate = 120 WHERE id = ?",
            (started_at, match["id"]),
        )

    current = match_service.serialize_match(match_service.get_current_match())
    assert current is not None
    assert current["duration_seconds"] >= 3599
    assert current["total_cost"] >= 119


def test_timer_stays_frozen_while_paused(runtime):
    match = match_service.start_match()
    started_at = (match_service.utc_now() - timedelta(seconds=15)).isoformat()

    with db() as connection:
        connection.execute(
            "UPDATE matches SET started_at = ? WHERE id = ?",
            (started_at, match["id"]),
        )

    paused = match_service.pause_match()
    assert paused is not None
    frozen_duration = match_service.compute_duration(paused)

    much_later = match_service.utc_now() + timedelta(minutes=10)
    assert match_service.compute_duration(paused, now=much_later) == frozen_duration

    serialized = match_service.serialize_match(paused)
    assert serialized is not None
    assert serialized["status"] == "paused"
    assert serialized["duration_seconds"] == frozen_duration


def test_replay_playlist_uses_available_segments(runtime):
    update_settings({"segment_seconds": 5, "buffer_minutes": 30})
    config.ensure_runtime_dirs()
    for index in range(4):
        segment = config.LIVE_DIR / f"segment_{index:06d}.ts"
        segment.write_bytes(b"fake")

    replay = video_service.create_replay("30s")

    assert replay["status"] == "limited"
    assert replay["available_seconds"] == 20
    assert (config.REPLAY_DIR / "replay_30s.m3u8").exists()
