from __future__ import annotations

from .. import config
from ..database import db


def get_settings() -> dict[str, str]:
    settings = dict(config.DEFAULT_SETTINGS)
    with db() as connection:
        rows = connection.execute("SELECT key, value FROM settings").fetchall()
    settings.update({row["key"]: row["value"] for row in rows})
    return settings


def update_settings(values: dict[str, object]) -> dict[str, str]:
    allowed = set(config.DEFAULT_SETTINGS.keys())
    cleaned = {
        key: str(value).lower() if isinstance(value, bool) else str(value)
        for key, value in values.items()
        if key in allowed
    }
    with db() as connection:
        for key, value in cleaned.items():
            connection.execute(
                """
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )
    return get_settings()


def setting_bool(settings: dict[str, str], key: str) -> bool:
    return settings.get(key, "false").strip().lower() in {"1", "true", "yes", "on"}


def setting_int(settings: dict[str, str], key: str, fallback: int) -> int:
    try:
        return int(settings.get(key, str(fallback)))
    except ValueError:
        return fallback


def setting_float(settings: dict[str, str], key: str, fallback: float) -> float:
    try:
        return float(settings.get(key, str(fallback)))
    except ValueError:
        return fallback

