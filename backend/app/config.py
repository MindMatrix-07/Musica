from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
GROUNDING_DIR = BASE_DIR / "grounding"
TEMP_UPLOAD_DIR = BASE_DIR / "tmp_uploads"

WEB_GUIDELINES_PATH = GROUNDING_DIR / "musixmatch_web_guidelines.txt"
EXTENDED_PDF_PATH = GROUNDING_DIR / "musixmatch_extended_guidelines.pdf"
EXTENDED_TXT_FALLBACK = GROUNDING_DIR / "musixmatch_extended_guidelines.txt"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
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
