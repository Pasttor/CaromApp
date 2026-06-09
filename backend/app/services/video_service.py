from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .. import config
from ..database import db
from .settings_service import get_settings, setting_bool, setting_int, update_settings


class VideoService:
    def __init__(self) -> None:
        self.process: subprocess.Popen[bytes] | None = None
        self.log_handle = None
        self.last_error = ""

    def ffmpeg_path(self) -> str | None:
        env_path = os.getenv("FFMPEG_PATH")
        if env_path and Path(env_path).exists():
            return env_path

        path_value = shutil.which("ffmpeg")
        if path_value:
            return path_value

        try:
            import imageio_ffmpeg

            bundled = imageio_ffmpeg.get_ffmpeg_exe()
            if bundled and Path(bundled).exists():
                return bundled
        except Exception:
            return None
        return None

    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def list_devices(self) -> dict[str, Any]:
        ffmpeg = self.ffmpeg_path()
        if not ffmpeg:
            return {
                "devices": [],
                "message": "FFmpeg no esta disponible para detectar camaras.",
            }

        if os.name == "nt":
            try:
                result = subprocess.run(
                    [
                        ffmpeg,
                        "-hide_banner",
                        "-list_devices",
                        "true",
                        "-f",
                        "dshow",
                        "-i",
                        "dummy",
                    ],
                    capture_output=True,
                    timeout=10,
                    check=False,
                )
                output = self._decode_process_output(result.stderr)
                devices = self._parse_windows_video_devices(output)
            except (OSError, subprocess.TimeoutExpired) as exc:
                return {
                    "devices": [],
                    "message": f"No se pudieron detectar camaras: {exc}",
                }
        else:
            devices = [
                {"id": str(path), "label": path.name}
                for path in sorted(Path("/dev").glob("video*"))
            ]

        return {
            "devices": devices,
            "message": (
                f"{len(devices)} camara(s) detectada(s)."
                if devices
                else "No se detectaron camaras USB."
            ),
        }

    def status(self) -> dict[str, Any]:
        self.sync_segments()
        ffmpeg = self.ffmpeg_path()
        available_seconds = self.available_seconds()
        running = self.is_running()

        if running:
            status = "running"
            message = "Grabando buffer circular."
        elif not ffmpeg:
            status = "error"
            message = "FFmpeg no esta disponible. Configura FFMPEG_PATH o instala imageio-ffmpeg."
        elif self.last_error:
            status = "error"
            message = self.last_error
        elif self.process and self.process.poll() is not None:
            status = "error"
            message = self._read_process_error()
        else:
            status = "idle"
            message = "Video listo para iniciar."

        return {
            "status": status,
            "running": running,
            "mode": "live" if running else "idle",
            "message": message,
            "ffmpeg_available": bool(ffmpeg),
            "live_url": "/media/live/live.m3u8" if (config.LIVE_DIR / "live.m3u8").exists() else None,
            "available_seconds": available_seconds,
        }

    def start(self) -> dict[str, Any]:
        if self.is_running():
            return self.status()

        ffmpeg = self.ffmpeg_path()
        if not ffmpeg:
            self.last_error = "FFmpeg no esta disponible."
            return self.status()

        config.ensure_runtime_dirs()
        self.last_error = ""
        self._clear_live_files()
        self._clear_replay_files()

        settings = get_settings()
        if (
            settings.get("camera_source_type") == "usb"
            and settings.get("camera_device") == "default"
            and not setting_bool(settings, "demo_mode_enabled")
        ):
            detected = self.list_devices()["devices"]
            if not detected:
                self.last_error = "No se detecto ninguna camara USB disponible."
                return self.status()
            selected_device = detected[0]["id"]
            settings["camera_device"] = selected_device
            update_settings({"camera_device": selected_device})

        args = self._build_ffmpeg_args(ffmpeg, settings)
        log_path = config.LOG_DIR / "ffmpeg.log"
        self.log_handle = log_path.open("ab")
        try:
            self.process = subprocess.Popen(
                args,
                stdout=subprocess.DEVNULL,
                stderr=self.log_handle,
                cwd=config.PROJECT_ROOT,
            )
        except Exception as exc:
            self.last_error = f"No se pudo iniciar FFmpeg: {exc}"
            self._close_log()
        return self.status()

    def stop(self) -> dict[str, Any]:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.process = None
        self._close_log()
        return self.status()

    def create_replay(self, window_key: str) -> dict[str, Any]:
        if window_key not in config.REPLAY_WINDOWS_SECONDS:
            raise ValueError("Ventana de replay no soportada.")

        self.sync_segments()
        settings = get_settings()
        segment_seconds = setting_int(settings, "segment_seconds", 5)
        requested_seconds = config.REPLAY_WINDOWS_SECONDS[window_key]
        needed_segments = max(1, math.ceil(requested_seconds / max(1, segment_seconds)))
        segments = self._segment_files()[-needed_segments:]

        if not segments:
            return {
                "mode": "replay",
                "status": "empty",
                "message": "Aun no hay segmentos de video disponibles.",
                "url": None,
                "available_seconds": 0,
                "requested_seconds": requested_seconds,
            }

        playlist_path = config.REPLAY_DIR / f"replay_{window_key}.m3u8"
        target_duration = max(1, segment_seconds)
        playlist_lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            f"#EXT-X-TARGETDURATION:{target_duration}",
            "#EXT-X-MEDIA-SEQUENCE:0",
            "#EXT-X-PLAYLIST-TYPE:VOD",
        ]
        for segment in segments:
            playlist_lines.append(f"#EXTINF:{float(segment_seconds):.3f},")
            playlist_lines.append(f"../live/{segment.name}")
        playlist_lines.append("#EXT-X-ENDLIST")
        playlist_path.write_text("\n".join(playlist_lines) + "\n", encoding="utf-8")

        available_seconds = len(segments) * segment_seconds
        limited = available_seconds < requested_seconds
        return {
            "mode": "replay",
            "status": "limited" if limited else "ready",
            "message": (
                f"Replay limitado a {available_seconds} segundos disponibles."
                if limited
                else "Replay listo."
            ),
            "url": f"/media/replay/{playlist_path.name}",
            "available_seconds": available_seconds,
            "requested_seconds": requested_seconds,
        }

    def live(self) -> dict[str, Any]:
        status = self.status()
        return {
            "mode": "live",
            "status": status["status"],
            "message": status["message"],
            "url": status["live_url"],
            "available_seconds": status["available_seconds"],
        }

    def available_seconds(self) -> int:
        settings = get_settings()
        return len(self._segment_files()) * setting_int(settings, "segment_seconds", 5)

    def sync_segments(self) -> None:
        settings = get_settings()
        segment_seconds = setting_int(settings, "segment_seconds", 5)
        max_segments = self._max_segments(settings)
        segment_files = self._segment_files()

        for old_segment in segment_files[:-max_segments]:
            try:
                old_segment.unlink()
            except OSError:
                pass

        segment_files = self._segment_files()
        with db() as connection:
            known_filenames = {path.name for path in segment_files}
            if known_filenames:
                placeholders = ",".join("?" for _ in known_filenames)
                connection.execute(
                    f"DELETE FROM video_segments WHERE filename NOT IN ({placeholders})",
                    tuple(known_filenames),
                )
            else:
                connection.execute("DELETE FROM video_segments")

            for index, segment in enumerate(segment_files):
                created_at = datetime.fromtimestamp(segment.stat().st_mtime, timezone.utc).isoformat()
                connection.execute(
                    """
                    INSERT INTO video_segments (
                        id, filename, path, created_at, duration_seconds, sequence
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(filename) DO UPDATE SET
                        path = excluded.path,
                        created_at = excluded.created_at,
                        duration_seconds = excluded.duration_seconds,
                        sequence = excluded.sequence
                    """,
                    (
                        str(uuid4()),
                        segment.name,
                        str(segment),
                        created_at,
                        segment_seconds,
                        index,
                    ),
                )

    def _build_ffmpeg_args(self, ffmpeg: str, settings: dict[str, str]) -> list[str]:
        segment_seconds = setting_int(settings, "segment_seconds", 5)
        max_segments = self._max_segments(settings)
        resolution = settings.get("video_resolution", "1280x720")
        fps = setting_int(settings, "video_fps", 30)
        source_type = settings.get("camera_source_type", "usb")
        device = settings.get("camera_device", "default")
        use_demo = setting_bool(settings, "demo_mode_enabled") and device == "default"

        args = [ffmpeg, "-hide_banner", "-loglevel", "warning", "-y"]
        if source_type == "demo" or use_demo:
            args += [
                "-f",
                "lavfi",
                "-re",
                "-i",
                f"testsrc2=size={resolution}:rate={fps}",
            ]
        elif source_type == "rtsp":
            args += ["-rtsp_transport", "tcp", "-i", device]
        else:
            if os.name == "nt":
                args += ["-f", "dshow", "-i", f"video={device}"]
            else:
                args += ["-f", "v4l2", "-i", device if device != "default" else "/dev/video0"]

        args += [
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-tune",
            "zerolatency",
            "-pix_fmt",
            "yuv420p",
            "-f",
            "hls",
            "-hls_time",
            str(segment_seconds),
            "-hls_list_size",
            str(max_segments),
            "-hls_flags",
            "delete_segments+append_list+program_date_time+omit_endlist",
            "-hls_segment_filename",
            str(config.LIVE_DIR / "segment_%06d.ts"),
            str(config.LIVE_DIR / "live.m3u8"),
        ]
        return args

    def _segment_files(self) -> list[Path]:
        config.ensure_runtime_dirs()
        return sorted(config.LIVE_DIR.glob("segment_*.ts"), key=lambda path: path.stat().st_mtime)

    def _max_segments(self, settings: dict[str, str]) -> int:
        buffer_minutes = setting_int(settings, "buffer_minutes", 30)
        segment_seconds = setting_int(settings, "segment_seconds", 5)
        return max(1, math.ceil((buffer_minutes * 60) / max(1, segment_seconds)))

    def _clear_replay_files(self) -> None:
        config.ensure_runtime_dirs()
        for playlist in config.REPLAY_DIR.glob("replay_*.m3u8"):
            try:
                playlist.unlink()
            except OSError:
                pass

    def _clear_live_files(self) -> None:
        config.ensure_runtime_dirs()
        for pattern in ("live.m3u8", "segment_*.ts"):
            for media_file in config.LIVE_DIR.glob(pattern):
                try:
                    media_file.unlink()
                except OSError:
                    pass
        with db() as connection:
            connection.execute("DELETE FROM video_segments")

    def _close_log(self) -> None:
        if self.log_handle:
            self.log_handle.close()
            self.log_handle = None

    def _read_process_error(self) -> str:
        log_path = config.LOG_DIR / "ffmpeg.log"
        if not log_path.exists():
            return "El proceso de video se detuvo."

        try:
            with log_path.open("rb") as log_file:
                log_file.seek(0, os.SEEK_END)
                size = log_file.tell()
                log_file.seek(max(0, size - 8192))
                output = self._decode_process_output(log_file.read())
        except OSError:
            return "El proceso de video se detuvo."

        if "Could not find video device" in output:
            return "No se encontro la camara seleccionada. Actualiza la lista de camaras."
        if "No space left on device" in output:
            return "No hay espacio suficiente en disco para grabar video."
        if "Could not run graph" in output or "device is already in use" in output.lower():
            return "La camara esta siendo usada por otra aplicacion."
        if "Error opening input" in output:
            return "No se pudo abrir la camara. Revisa permisos o cierra otras aplicaciones."
        return "El proceso de video se detuvo. Revisa data/logs/ffmpeg.log."

    @staticmethod
    def _decode_process_output(output: bytes) -> str:
        for encoding in ("utf-8", "cp1252"):
            try:
                return output.decode(encoding)
            except UnicodeDecodeError:
                continue
        return output.decode("utf-8", errors="replace")

    @staticmethod
    def _parse_windows_video_devices(output: str) -> list[dict[str, str]]:
        names = re.findall(r'"([^"]+)"\s+\(video\)', output)
        return [{"id": name, "label": name} for name in dict.fromkeys(names)]


video_service = VideoService()
