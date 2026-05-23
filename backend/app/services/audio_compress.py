import logging
import os
from pathlib import Path

from app.config import COMPRESS_TARGET_BYTES

logger = logging.getLogger(__name__)


def compress_audio_if_needed(path: Path) -> tuple[Path, bool]:
    """
    Shrink audio when over COMPRESS_TARGET_BYTES.
    Uses ffmpeg via pydub when available; otherwise returns original path.
    """
    size = path.stat().st_size
    if size <= COMPRESS_TARGET_BYTES:
        return path, False

    try:
        from pydub import AudioSegment
    except ImportError:
        logger.warning("pydub not installed; skipping server-side compression")
        return path, False

    try:
        audio = AudioSegment.from_file(str(path))
        audio = audio.set_channels(1).set_frame_rate(22050)
        out = path.with_name(f"{path.stem}_compressed.mp3")
        bitrate = "96k" if size > COMPRESS_TARGET_BYTES * 2 else "128k"
        audio.export(str(out), format="mp3", bitrate=bitrate)
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
