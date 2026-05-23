from functools import lru_cache
from pathlib import Path

from app.config import EXTENDED_PDF_PATH, EXTENDED_TXT_FALLBACK, WEB_GUIDELINES_PATH

GUIDELINES_SOURCES = """
Official sources (always apply web + extended together):
- Web: https://community.musixmatch.com/guidelines?lng=en
- Extended: https://docs.google.com/document/d/1njyoifp2cyG-IQu0495eX1Mo0Hp2qy-vl4IeHX0DSCw/preview
"""


def _read_text(path: Path, fallback: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return fallback


@lru_cache(maxsize=1)
def load_web_guidelines() -> str:
    return _read_text(
        WEB_GUIDELINES_PATH,
        "(Web guidelines file missing on server.)",
    )


@lru_cache(maxsize=1)
def load_extended_guidelines() -> str:
    if EXTENDED_PDF_PATH.is_file():
        try:
            from pypdf import PdfReader

            reader = PdfReader(str(EXTENDED_PDF_PATH))
            parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
            if parts:
                return "\n\n".join(parts)
        except Exception:
            pass
    if EXTENDED_TXT_FALLBACK.is_file():
        return _read_text(
            EXTENDED_TXT_FALLBACK,
            "(Extended guidelines not found.)",
        )
    return "(Extended guidelines not found on server.)"


@lru_cache(maxsize=1)
def load_combined_guidelines() -> str:
    web = load_web_guidelines()
    extended = load_extended_guidelines()
    return f"""{GUIDELINES_SOURCES}

=== MUSIXMATCH WEB GUIDELINES (all sections: Transcribe, Format, Sync, Tag Structure, Tag Performers, Translate) ===
{web}

=== MUSIXMATCH EXTENDED GUIDELINES ===
{extended}
"""


def ensure_grounding_files() -> None:
    """Warn via fallback text if files are missing — never crash the function."""
    if not WEB_GUIDELINES_PATH.is_file():
        load_web_guidelines.cache_clear()
        load_combined_guidelines.cache_clear()
