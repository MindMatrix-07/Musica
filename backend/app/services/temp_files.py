import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, TEMP_UPLOAD_DIR


def ensure_temp_dir() -> Path:
    TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_UPLOAD_DIR


def secure_filename(original: str) -> str:
    base = Path(original).name
    safe = "".join(c for c in base if c.isalnum() or c in "._- ")
    return safe.replace(" ", "_") or "upload"


async def save_upload_transient(file: UploadFile) -> Path:
    """Save upload to a unique temp path; caller must delete after use."""
    ensure_temp_dir()
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if len(content) == 0:
        raise ValueError("Empty file")

    token = uuid.uuid4().hex
    dest = TEMP_UPLOAD_DIR / f"{token}{ext}"
    dest.write_bytes(content)
    return dest


def delete_file(path: Path) -> None:
    try:
        if path.exists():
            os.remove(path)
    except OSError:
        pass


def purge_stale_temp(max_age_seconds: int = 3600) -> None:
    """Best-effort cleanup of orphaned temp files."""
    ensure_temp_dir()
    now = __import__("time").time()
    for p in TEMP_UPLOAD_DIR.glob("*"):
        if p.is_file() and (now - p.stat().st_mtime) > max_age_seconds:
            delete_file(p)
