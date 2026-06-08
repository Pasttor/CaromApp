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


def start_match() -> dict[str, Any]:
    existing = get_current_match()
    if existing:
        return existing

    settings = get_settings()
    match_id = str(uuid4())
    now = iso_now()
    hourly_rate = setting_float(settings, "hourly_rate_mxn", 120.0)
    with db() as connection:
        connection.execute(
            """
            INSERT INTO matches (
                id, player_1_name, player_2_name, started_at, hourly_rate, status
            )
            VALUES (?, ?, ?, ?, ?, 'active')
            """,
            (match_id, "Jugador 1", "Jugador 2", now, hourly_rate),
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


def reset_score() -> dict[str, Any]:
    match = get_or_create_match()
    with db() as connection:
        connection.execute(
            "UPDATE matches SET player_1_score = 0, player_2_score = 0 WHERE id = ?",
            (match["id"],),
        )
        connection.execute("DELETE FROM score_events WHERE match_id = ?", (match["id"],))
    return get_current_match() or match


def change_score(player_number: int, delta: int) -> dict[str, Any]:
    if player_number not in {1, 2}:
        raise ValueError("player_number debe ser 1 o 2")
    if delta == 0:
        return get_or_create_match()

    settings = get_settings()
    allow_negative = setting_bool(settings, "allow_negative_scores")
    match = get_or_create_match()
    score_key = f"player_{player_number}_score"
    previous_score = int(match[score_key])
    new_score = previous_score + int(delta)
    if not allow_negative:
        new_score = max(0, new_score)
    actual_delta = new_score - previous_score

    with db() as connection:
        connection.execute(
            f"UPDATE matches SET {score_key} = ?, current_turn = ? WHERE id = ?",
            (new_score, 2 if player_number == 1 else 1, match["id"]),
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
    if player_number not in {1, 2}:
        raise ValueError("player_number debe ser 1 o 2")
    cleaned = name.strip() or f"Jugador {player_number}"
    match = get_or_create_match()
    name_key = f"player_{player_number}_name"
    with db() as connection:
        connection.execute(
            f"UPDATE matches SET {name_key} = ? WHERE id = ?",
            (cleaned, match["id"]),
        )
    return get_current_match() or match


def set_turn(player_number: int) -> dict[str, Any]:
    if player_number not in {1, 2}:
        raise ValueError("current_turn debe ser 1 o 2")
    match = get_or_create_match()
    with db() as connection:
        connection.execute(
            "UPDATE matches SET current_turn = ? WHERE id = ?",
            (player_number, match["id"]),
        )
    return get_current_match() or match
