import json

from app.config import MAX_TRAINING_CHARS


def parse_training_messages(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()]
    except json.JSONDecodeError:
        pass
    return [line.strip() for line in raw.splitlines() if line.strip()]


def build_training_block(messages: list[str]) -> str:
    if not messages:
        return ""
    joined = "\n".join(f"- {m}" for m in messages)
    text = f"""
--- YOUR TRAINED PREFERENCES (from saved messages) ---
Apply these consistently when compatible with Musixmatch official rules:

{joined}
"""
    if len(text) > MAX_TRAINING_CHARS:
        return text[:MAX_TRAINING_CHARS] + "\n…"
    return text
