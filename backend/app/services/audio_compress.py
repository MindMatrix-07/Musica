import logging
import os
from pathlib import Path

from app.config import COMPRESS_TARGET_BYTES, IS_VERCEL, UPLOAD_MAX_BYTES

logger = logging.getLogger(__name__)

_SERVER_BITRATES = ("192k", "160k", "128k", "112k", "96k")


def compress_audio_if_needed(path: Path) -> tuple[Path, bool]:
    """
    Shrink audio when over COMPRESS_TARGET_BYTES.
    Skipped on Vercel (no ffmpeg; client already compresses).
    """
    size = path.stat().st_size
    if size <= COMPRESS_TARGET_BYTES:
        return path, False

    if IS_VERCEL:
        if size > UPLOAD_MAX_BYTES:
            raise ValueError(
                f"File exceeds {UPLOAD_MAX_BYTES // (1024 * 1024)} MB upload limit. "
                "Use browser compression before upload."
            )
        return path, False

    try:
        from pydub import AudioSegment
    except ImportError:
        logger.warning("pydub not installed; skipping server-side compression")
        return path, False

    try:
        audio = AudioSegment.from_file(str(path))
        audio = audio.set_channels(1).set_frame_rate(32000)
        out = path.with_name(f"{path.stem}_compressed.mp3")

        for bitrate in _SERVER_BITRATES:
            audio.export(str(out), format="mp3", bitrate=bitrate)
            if not out.exists():
                continue
            out_size = out.stat().st_size
            if out_size <= UPLOAD_MAX_BYTES and out_size < size:
                logger.info(
                    "Server compressed %s -> %s at %s",
                    size,
                    out_size,
                    bitrate,
                )
                return out, True

        if out.exists() and out.stat().st_size < size:
            return out, True
    except Exception as exc:
        logger.warning("Server-side audio compression failed: %s", exc)

    return path, False


def cleanup_compressed(path: Path, original: Path) -> None:
    if path != original and path.exists():
        try:
            os.remove(path)
        except OSError:
            pass
