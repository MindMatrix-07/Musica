import time
from pathlib import Path

from google import genai
from google.genai import types

from app.config import (
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    MODEL_ALIASES,
)
from app.prompts import (
    SYSTEM_INSTRUCTION,
    USER_INSTRUCTIONS_BLOCK,
    USER_TASK_TEMPLATE,
)
from app.services.grounding import load_extended_guidelines, load_web_guidelines


def _build_user_instructions_block(user_prompt: str | None) -> str:
    text = (user_prompt or "").strip()
    if not text:
        return ""
    return USER_INSTRUCTIONS_BLOCK.format(user_prompt=text)


def resolve_model(model_id: str) -> str:
    return MODEL_ALIASES.get(model_id, model_id or DEFAULT_MODEL)


def _wait_for_file_active(client: genai.Client, uploaded, timeout_sec: int = 120) -> None:
    """Poll until uploaded file is ACTIVE."""
    deadline = time.time() + timeout_sec
    name = uploaded.name
    while time.time() < deadline:
        file_info = client.files.get(name=name)
        state = getattr(file_info, "state", None)
        state_name = state.name if hasattr(state, "name") else str(state)
        if state_name == "ACTIVE":
            return
        if state_name == "FAILED":
            raise RuntimeError(f"Gemini file processing failed: {name}")
        time.sleep(2)
    raise TimeoutError(f"Timed out waiting for file to become ACTIVE: {name}")


def _make_client(api_key: str | None) -> genai.Client:
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client()


def curate_audio(
    audio_path: Path,
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = DEFAULT_TEMPERATURE,
    api_key: str | None = None,
    user_prompt: str | None = None,
) -> str:
    """
    Upload audio to Gemini, run curation with system instruction + grounding text.
    """
    client = _make_client(api_key)
    resolved_model = resolve_model(model)

    uploaded = client.files.upload(file=str(audio_path))
    _wait_for_file_active(client, uploaded)

    web = load_web_guidelines()
    extended = load_extended_guidelines()
    user_text = USER_TASK_TEMPLATE.format(
        web_guidelines=web,
        extended_guidelines=extended,
        user_instructions_block=_build_user_instructions_block(user_prompt),
    )

    try:
        response = client.models.generate_content(
            model=resolved_model,
            contents=[uploaded, user_text],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=temperature,
            ),
        )
    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:
            pass

    text = response.text
    if not text:
        raise RuntimeError("Model returned empty lyrics output")
    return text.strip()
