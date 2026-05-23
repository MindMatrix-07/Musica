#!/usr/bin/env python3
"""
End-to-end smoke test for google-genai file upload + curation.
Usage (from backend/):
  set GEMINI_API_KEY=your_key
  python scripts/test_gemini_upload.py path/to/track.mp3
"""
import sys
from pathlib import Path

# Add backend root to path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.gemini_curator import curate_audio  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_gemini_upload.py <audio.mp3|wav>")
        sys.exit(1)

    audio = Path(sys.argv[1])
    if not audio.exists():
        print(f"File not found: {audio}")
        sys.exit(1)

    print(f"Curating {audio} ...")
    result = curate_audio(audio, model="gemini-2.5-flash", temperature=0.1)
    print("\n--- OUTPUT ---\n")
    print(result)


if __name__ == "__main__":
    main()
