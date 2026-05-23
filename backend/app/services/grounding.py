from pathlib import Path

from app.config import EXTENDED_PDF_PATH, EXTENDED_TXT_FALLBACK, WEB_GUIDELINES_PATH


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


def ensure_grounding_files() -> None:
    """Verify baseline grounding files exist."""
    if not WEB_GUIDELINES_PATH.exists():
        raise FileNotFoundError(f"Missing {WEB_GUIDELINES_PATH}")
