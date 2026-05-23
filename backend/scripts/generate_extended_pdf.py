#!/usr/bin/env python3
"""Generate placeholder musixmatch_extended_guidelines.pdf from txt fallback."""
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

BACKEND_ROOT = Path(__file__).resolve().parent.parent
TXT = BACKEND_ROOT / "grounding" / "musixmatch_extended_guidelines.txt"
PDF = BACKEND_ROOT / "grounding" / "musixmatch_extended_guidelines.pdf"


def wrap_lines(text: str, width: int = 90) -> list[str]:
    lines = []
    for paragraph in text.splitlines():
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split()
        current = []
        for w in words:
            trial = " ".join(current + [w])
            if len(trial) <= width:
                current.append(w)
            else:
                if current:
                    lines.append(" ".join(current))
                current = [w]
        if current:
            lines.append(" ".join(current))
    return lines


def main() -> None:
    text = TXT.read_text(encoding="utf-8") if TXT.exists() else "Musixmatch Extended Guidelines Placeholder"
    c = canvas.Canvas(str(PDF), pagesize=letter)
    width, height = letter
    y = height - 72
    c.setFont("Helvetica", 10)
    for line in wrap_lines(text):
        if y < 72:
            c.showPage()
            c.setFont("Helvetica", 10)
            y = height - 72
        c.drawString(72, y, line[:100])
        y -= 14
    c.save()
    print(f"Wrote {PDF}")


if __name__ == "__main__":
    main()
