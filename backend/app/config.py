import os
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent


def _resolve_grounding_dir() -> Path:
    """Find grounding files in dev, Vercel bundle, or monorepo layouts."""
    candidates = [
        _BACKEND_DIR / "grounding",
        _APP_DIR / "grounding",
        Path.cwd() / "backend" / "grounding",
        Path.cwd() / "grounding",
    ]
    for path in candidates:
        if (path / "musixmatch_web_guidelines.txt").is_file():
            return path
    return candidates[0]


GROUNDING_DIR = _resolve_grounding_dir()

IS_VERCEL = bool(os.getenv("VERCEL"))
API_ROUTE_PREFIX = "" if IS_VERCEL else "/api"
TEMP_UPLOAD_DIR = (
    Path("/tmp/musica_uploads") if IS_VERCEL else _BACKEND_DIR / "tmp_uploads"
)

WEB_GUIDELINES_PATH = GROUNDING_DIR / "musixmatch_web_guidelines.txt"
EXTENDED_PDF_PATH = GROUNDING_DIR / "musixmatch_extended_guidelines.pdf"
EXTENDED_TXT_FALLBACK = GROUNDING_DIR / "musixmatch_extended_guidelines.txt"

UPLOAD_MAX_BYTES = 4 * 1024 * 1024 if IS_VERCEL else 50 * 1024 * 1024
MAX_UPLOAD_BYTES = UPLOAD_MAX_BYTES
MAX_USER_PROMPT_CHARS = 2000
MAX_TRAINING_CHARS = 8000
COMPRESS_TARGET_BYTES = int(UPLOAD_MAX_BYTES * 0.92) if IS_VERCEL else UPLOAD_MAX_BYTES

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".webm", ".ogg"}
ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/webm",
    "audio/ogg",
    "application/ogg",
}

MODEL_FAST = "gemini-3.5-flash"
MODEL_DEEP = "gemini-3.5-pro"
DEFAULT_MODEL = MODEL_FAST
DEFAULT_TEMPERATURE = 0.1

MODEL_API_FALLBACKS = {
    "gemini-3.5-flash": [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-3.5-flash",
    ],
    "gemini-3.5-pro": [
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-3.5-pro",
    ],
}

PROVIDER_GEMINI = "gemini"
PROVIDER_OPENAI = "openai"
