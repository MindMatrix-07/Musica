import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
GROUNDING_DIR = BASE_DIR / "grounding"

IS_VERCEL = bool(os.getenv("VERCEL"))
API_ROUTE_PREFIX = "" if IS_VERCEL else "/api"
TEMP_UPLOAD_DIR = (
    Path("/tmp/musica_uploads") if IS_VERCEL else BASE_DIR / "tmp_uploads"
)

WEB_GUIDELINES_PATH = GROUNDING_DIR / "musixmatch_web_guidelines.txt"
EXTENDED_PDF_PATH = GROUNDING_DIR / "musixmatch_extended_guidelines.pdf"
EXTENDED_TXT_FALLBACK = GROUNDING_DIR / "musixmatch_extended_guidelines.txt"

MAX_UPLOAD_BYTES = (
    4 * 1024 * 1024 if IS_VERCEL else 50 * 1024 * 1024
)
MAX_USER_PROMPT_CHARS = 2000
MAX_TRAINING_CHARS = 8000
COMPRESS_TARGET_BYTES = 4 * 1024 * 1024

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

# User-facing model IDs (sent from UI, used in API calls)
MODEL_FAST = "gemini-3.5-flash"
MODEL_DEEP = "gemini-3.5-pro"
DEFAULT_MODEL = MODEL_FAST
DEFAULT_TEMPERATURE = 0.1

# Optional API fallbacks if a preview name is unavailable
MODEL_API_FALLBACKS = {
    "gemini-3.5-flash": ["gemini-3.5-flash", "gemini-2.5-flash"],
    "gemini-3.5-pro": ["gemini-3.5-pro", "gemini-2.5-pro", "gemini-1.5-pro"],
}

PROVIDER_GEMINI = "gemini"
PROVIDER_OPENAI = "openai"
