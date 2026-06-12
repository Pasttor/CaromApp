from __future__ import annotations

from datetime import timedelta

import pytest

from app import config
from app.database import db, initialize_database
from app.services import match_service
from app.services.settings_service import get_settings, update_settings
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


def test_match_supports_four_players(runtime):
    match = match_service.start_match(4)

    assert match["player_count"] == 4
    assert match["player_3_name"] == "Jugador 3"
    assert match["player_4_name"] == "Jugador 4"

    match = match_service.change_score(3, 5)
    assert match["player_3_score"] == 5
    assert match["current_turn"] == 4

    match = match_service.change_score(4, 2)
    assert match["player_4_score"] == 2
    assert match["current_turn"] == 1

    renamed = match_service.rename_player(4, "Daniel")
    assert renamed["player_4_name"] == "Daniel"


def test_match_rejects_players_outside_selected_count(runtime):
    match_service.start_match(3)

    with pytest.raises(ValueError, match="entre 1 y 3"):
        match_service.change_score(4, 1)


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


def test_new_set_ends_current_match_and_waits_for_next_start(runtime):
    first_match = match_service.start_match()
    match_service.rename_player(1, "Ana")
    match_service.change_score(1, 5)

    ended_match = match_service.new_set()

    assert ended_match is not None
    assert ended_match["id"] == first_match["id"]
    assert ended_match["status"] == "ended"
    assert match_service.get_current_match() is None

    with db() as connection:
        previous = connection.execute(
            "SELECT status FROM matches WHERE id = ?",
            (first_match["id"],),
        ).fetchone()
    assert previous["status"] == "ended"

    next_match = match_service.start_match()
    assert next_match["id"] != first_match["id"]
    assert next_match["player_1_name"] == "Jugador 1"
    assert next_match["player_2_name"] == "Jugador 2"
    assert next_match["player_1_score"] == 0
    assert next_match["player_2_score"] == 0
    assert next_match["status"] == "active"


def test_windows_camera_device_output_is_parsed(runtime):
    output = """
    [dshow @ 000001] "Integrated Webcam" (video)
    [dshow @ 000001] "Integrated Webcam" (video)
    [dshow @ 000001] "Microphone" (audio)
    """

    assert video_service._parse_windows_video_devices(output) == [
        {"id": "Integrated Webcam", "label": "Integrated Webcam"}
    ]


def test_video_start_resolves_default_usb_camera(runtime, monkeypatch):
    update_settings(
        {
            "camera_source_type": "usb",
            "camera_device": "default",
            "demo_mode_enabled": "false",
        }
    )
    monkeypatch.setattr(video_service, "ffmpeg_path", lambda: "ffmpeg")
    monkeypatch.setattr(
        video_service,
        "list_devices",
        lambda: {
            "devices": [{"id": "Integrated Webcam", "label": "Integrated Webcam"}],
            "message": "1 camara(s) detectada(s).",
        },
    )

    captured_args = []

    class FakeProcess:
        def poll(self):
            return None

    def fake_popen(args, **kwargs):
        captured_args.extend(args)
        return FakeProcess()

    monkeypatch.setattr("app.services.video_service.subprocess.Popen", fake_popen)
    result = video_service.start()

    assert result["running"] is True
    assert "video=Integrated Webcam" in captured_args
    assert get_settings()["camera_device"] == "Integrated Webcam"
    video_service.process = None
    video_service._close_log()


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
