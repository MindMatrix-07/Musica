from pathlib import Path

from app.config import EXTENDED_PDF_PATH, EXTENDED_TXT_FALLBACK, WEB_GUIDELINES_PATH

GUIDELINES_SOURCES = """
Official sources (always apply web + extended together):
- Web: https://community.musixmatch.com/guidelines?lng=en
- Extended: https://docs.google.com/document/d/1njyoifp2cyG-IQu0495eX1Mo0Hp2qy-vl4IeHX0DSCw/preview
"""


def load_web_guidelines() -> str:
    return WEB_GUIDELINES_PATH.read_text(encoding="utf-8")


def load_extended_guidelines() -> str:
    if EXTENDED_PDF_PATH.exists():
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
    if EXTENDED_TXT_FALLBACK.exists():
        return EXTENDED_TXT_FALLBACK.read_text(encoding="utf-8")
    return "(Extended guidelines PDF not found. Add musixmatch_extended_guidelines.pdf to backend/grounding/.)"


def load_combined_guidelines() -> str:
    """Web + extended guidelines in one block for every AI pass."""
    web = load_web_guidelines()
    extended = load_extended_guidelines()
    return f"""{GUIDELINES_SOURCES}

=== MUSIXMATCH WEB GUIDELINES (all sections: Transcribe, Format, Sync, Tag Structure, Tag Performers, Translate) ===
{web}

=== MUSIXMATCH EXTENDED GUIDELINES ===
{extended}
"""


def ensure_grounding_files() -> None:
    if not WEB_GUIDELINES_PATH.exists():
        raise FileNotFoundError(f"Missing {WEB_GUIDELINES_PATH}")
