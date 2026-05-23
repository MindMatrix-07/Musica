import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
GROUNDING_DIR = BASE_DIR / "grounding"

# Vercel serverless: only /tmp is writable; Services strip /api prefix from paths
IS_VERCEL = bool(os.getenv("VERCEL"))
API_ROUTE_PREFIX = "" if IS_VERCEL else "/api"
TEMP_UPLOAD_DIR = (
    Path("/tmp/musica_uploads") if IS_VERCEL else BASE_DIR / "tmp_uploads"
)

WEB_GUIDELINES_PATH = GROUNDING_DIR / "musixmatch_web_guidelines.txt"
EXTENDED_PDF_PATH = GROUNDING_DIR / "musixmatch_extended_guidelines.pdf"
EXTENDED_TXT_FALLBACK = GROUNDING_DIR / "musixmatch_extended_guidelines.txt"

# Vercel serverless body limit ~4.5 MB on Hobby
MAX_UPLOAD_BYTES = (
    4 * 1024 * 1024 if IS_VERCEL else 50 * 1024 * 1024
)
MAX_USER_PROMPT_CHARS = 2000
ALLOWED_EXTENSIONS = {".mp3", ".wav"}
ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
}

DEFAULT_MODEL = "gemini-2.5-flash"
MODEL_FAST = "gemini-2.5-flash"
MODEL_DEEP = "gemini-2.5-pro"
DEFAULT_TEMPERATURE = 0.1

# UI sends these IDs; map to available API models when names differ
MODEL_ALIASES = {
    "gemini-3.5-flash": "gemini-2.5-flash",
    "gemini-1.5-pro": "gemini-2.5-pro",
}
