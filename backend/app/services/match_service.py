from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from ..database import db, row_to_dict
from .settings_service import get_settings, setting_bool, setting_float


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def get_current_match() -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute(
            """
            SELECT * FROM matches
            WHERE status IN ('active', 'paused')
            ORDER BY started_at DESC
            LIMIT 1
            """
        ).fetchone()
    return row_to_dict(row)


def get_latest_match() -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute(
            "SELECT * FROM matches ORDER BY started_at DESC LIMIT 1"
        ).fetchone()
    return row_to_dict(row)


def validate_player_count(player_count: int) -> int:
    if player_count not in {2, 3, 4}:
        raise ValueError("player_count debe ser 2, 3 o 4")
    return player_count


def get_or_create_match() -> dict[str, Any]:
    match = get_current_match()
    if match:
        return match
    return start_match()


def compute_duration(match: dict[str, Any], now: datetime | None = None) -> int:
    if match.get("status") == "paused":
        return max(0, int(match.get("duration_seconds") or 0))

    started_at = parse_iso(match.get("started_at"))
    if not started_at:
        return 0

    effective_now = now or utc_now()
    ended_at = parse_iso(match.get("ended_at")) or effective_now
    paused_seconds = int(match.get("paused_seconds") or 0)

    duration = int((ended_at - started_at).total_seconds()) - paused_seconds
    return max(0, duration)


def serialize_match(match: dict[str, Any] | None) -> dict[str, Any] | None:
    if not match:
        return None
    duration = compute_duration(match)
    hourly_rate = float(match.get("hourly_rate") or 0)
    total_cost = round((duration / 3600) * hourly_rate, 2)
    serialized = dict(match)
    serialized["duration_seconds"] = duration
    serialized["total_cost"] = total_cost if match.get("status") != "ended" else match.get("total_cost", total_cost)
    serialized["hourly_rate_mxn"] = hourly_rate
    return serialized


def get_score_history(limit: int = 12) -> list[dict[str, Any]]:
    match = get_current_match() or get_latest_match()
    if not match:
        return []
    with db() as connection:
        rows = connection.execute(
            """
            SELECT * FROM score_events
            WHERE match_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (match["id"], limit),
        ).fetchall()
    return [row_to_dict(row) for row in rows if row is not None]


def start_match(player_count: int = 2) -> dict[str, Any]:
    existing = get_current_match()
    if existing:
        return existing

    player_count = validate_player_count(player_count)
    settings = get_settings()
    match_id = str(uuid4())
    now = iso_now()
    hourly_rate = setting_float(settings, "hourly_rate_mxn", 120.0)
    with db() as connection:
        connection.execute(
            """
            INSERT INTO matches (
                id, player_count, player_1_name, player_2_name,
                player_3_name, player_4_name, started_at, hourly_rate, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            """,
            (
                match_id,
                player_count,
                "Jugador 1",
                "Jugador 2",
                "Jugador 3",
                "Jugador 4",
                now,
                hourly_rate,
            ),
        )
    return get_current_match() or {}


def pause_match() -> dict[str, Any] | None:
    match = get_current_match()
    if not match or match["status"] == "paused":
        return match

    paused_at = utc_now()
    duration = compute_duration(match, now=paused_at)
    with db() as connection:
        connection.execute(
            """
            UPDATE matches
            SET status = 'paused',
                pause_started_at = ?,
                duration_seconds = ?
            WHERE id = ?
            """,
            (paused_at.isoformat(), duration, match["id"]),
        )
    return get_current_match()


def resume_match() -> dict[str, Any] | None:
    match = get_current_match()
    if not match or match["status"] != "paused":
        return match

    pause_started_at = parse_iso(match.get("pause_started_at"))
    extra_pause = 0
    if pause_started_at:
        extra_pause = max(0, int((utc_now() - pause_started_at).total_seconds()))

    with db() as connection:
        connection.execute(
            """
            UPDATE matches
            SET status = 'active',
                paused_seconds = paused_seconds + ?,
                pause_started_at = NULL
            WHERE id = ?
            """,
            (extra_pause, match["id"]),
        )
    return get_current_match()


def end_match() -> dict[str, Any] | None:
    match = get_current_match()
    if not match:
        return None

    if match["status"] == "paused":
        match = resume_match() or match

    duration = compute_duration(match)
    total_cost = round((duration / 3600) * float(match.get("hourly_rate") or 0), 2)
    ended_at = iso_now()
    with db() as connection:
        connection.execute(
            """
            UPDATE matches
            SET status = 'ended',
                ended_at = ?,
                duration_seconds = ?,
                total_cost = ?
            WHERE id = ?
            """,
            (ended_at, duration, total_cost, match["id"]),
        )
        row = connection.execute("SELECT * FROM matches WHERE id = ?", (match["id"],)).fetchone()
    return row_to_dict(row)


def new_set() -> dict[str, Any] | None:
    return end_match()


def reset_score() -> dict[str, Any]:
    match = get_or_create_match()
    with db() as connection:
        connection.execute(
            """
            UPDATE matches
            SET player_1_score = 0,
                player_2_score = 0,
                player_3_score = 0,
                player_4_score = 0
            WHERE id = ?
            """,
            (match["id"],),
        )
        connection.execute("DELETE FROM score_events WHERE match_id = ?", (match["id"],))
    return get_current_match() or match


def change_score(player_number: int, delta: int) -> dict[str, Any]:
    match = get_or_create_match()
    player_count = int(match.get("player_count") or 2)
    if player_number not in range(1, player_count + 1):
        raise ValueError(f"player_number debe estar entre 1 y {player_count}")
    if delta == 0:
        return match

    settings = get_settings()
    allow_negative = setting_bool(settings, "allow_negative_scores")
    score_key = f"player_{player_number}_score"
    previous_score = int(match[score_key])
    new_score = previous_score + int(delta)
    if not allow_negative:
        new_score = max(0, new_score)
    actual_delta = new_score - previous_score

    with db() as connection:
        connection.execute(
            f"UPDATE matches SET {score_key} = ?, current_turn = ? WHERE id = ?",
            (new_score, (player_number % player_count) + 1, match["id"]),
        )
        connection.execute(
            """
            INSERT INTO score_events (
                id, match_id, player_number, delta, previous_score, new_score, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid4()),
                match["id"],
                player_number,
                actual_delta,
                previous_score,
                new_score,
                iso_now(),
            ),
        )
    return get_current_match() or match


def undo_last_score() -> dict[str, Any] | None:
    match = get_current_match()
    if not match:
        return None

    with db() as connection:
        event = connection.execute(
            """
            SELECT * FROM score_events
            WHERE match_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (match["id"],),
        ).fetchone()
        if not event:
            return match

        score_key = f"player_{event['player_number']}_score"
        connection.execute(
            f"UPDATE matches SET {score_key} = ? WHERE id = ?",
            (event["previous_score"], match["id"]),
        )
        connection.execute("DELETE FROM score_events WHERE id = ?", (event["id"],))
    return get_current_match()


def rename_player(player_number: int, name: str) -> dict[str, Any]:
    match = get_or_create_match()
    player_count = int(match.get("player_count") or 2)
    if player_number not in range(1, player_count + 1):
        raise ValueError(f"player_number debe estar entre 1 y {player_count}")
    cleaned = name.strip() or f"Jugador {player_number}"
    name_key = f"player_{player_number}_name"
    with db() as connection:
        connection.execute(
            f"UPDATE matches SET {name_key} = ? WHERE id = ?",
            (cleaned, match["id"]),
        )
    return get_current_match() or match


def set_turn(player_number: int) -> dict[str, Any]:
    match = get_or_create_match()
    player_count = int(match.get("player_count") or 2)
    if player_number not in range(1, player_count + 1):
        raise ValueError(f"current_turn debe estar entre 1 y {player_count}")
    with db() as connection:
        connection.execute(
            "UPDATE matches SET current_turn = ? WHERE id = ?",
            (player_number, match["id"]),
        )
    return get_current_match() or match
