from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from . import config


def get_connection() -> sqlite3.Connection:
    config.ensure_runtime_dirs()
    connection = sqlite3.connect(config.DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    config.ensure_runtime_dirs()
    with db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS matches (
                id TEXT PRIMARY KEY,
                player_count INTEGER NOT NULL DEFAULT 2,
                player_1_name TEXT NOT NULL,
                player_2_name TEXT NOT NULL,
                player_3_name TEXT NOT NULL DEFAULT 'Jugador 3',
                player_4_name TEXT NOT NULL DEFAULT 'Jugador 4',
                player_1_score INTEGER NOT NULL DEFAULT 0,
                player_2_score INTEGER NOT NULL DEFAULT 0,
                player_3_score INTEGER NOT NULL DEFAULT 0,
                player_4_score INTEGER NOT NULL DEFAULT 0,
                current_turn INTEGER NOT NULL DEFAULT 1,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                paused_seconds INTEGER NOT NULL DEFAULT 0,
                pause_started_at TEXT,
                hourly_rate REAL NOT NULL DEFAULT 120,
                total_cost REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS score_events (
                id TEXT PRIMARY KEY,
                match_id TEXT NOT NULL,
                player_number INTEGER NOT NULL,
                delta INTEGER NOT NULL,
                previous_score INTEGER NOT NULL,
                new_score INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS video_segments (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL UNIQUE,
                path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                sequence INTEGER NOT NULL DEFAULT 0
            );
            """
        )

        match_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(matches)").fetchall()
        }
        match_migrations = {
            "player_count": "INTEGER NOT NULL DEFAULT 2",
            "player_3_name": "TEXT NOT NULL DEFAULT 'Jugador 3'",
            "player_4_name": "TEXT NOT NULL DEFAULT 'Jugador 4'",
            "player_3_score": "INTEGER NOT NULL DEFAULT 0",
            "player_4_score": "INTEGER NOT NULL DEFAULT 0",
        }
        for column, definition in match_migrations.items():
            if column not in match_columns:
                connection.execute(
                    f"ALTER TABLE matches ADD COLUMN {column} {definition}"
                )

        for key, value in config.DEFAULT_SETTINGS.items():
            connection.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}
