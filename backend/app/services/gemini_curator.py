import time
from pathlib import Path

from google import genai
from google.genai import types

from app.config import (
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    MODEL_ALIASES,
    MODEL_DEEP,
)
from app.prompts import (
    STRUCTURE_SYSTEM,
    STRUCTURE_TASK,
    SYSTEM_INSTRUCTION,
    TRANSCRIPTION_SYSTEM,
    TRANSCRIPTION_TASK,
    USER_INSTRUCTIONS_BLOCK,
    USER_TASK_TEMPLATE,
)
from app.services.grounding import (
    load_combined_guidelines,
    load_extended_guidelines,
    load_web_guidelines,
)


def _build_user_instructions_block(user_prompt: str | None) -> str:
    text = (user_prompt or "").strip()
    if not text:
        return ""
    return USER_INSTRUCTIONS_BLOCK.format(user_prompt=text)


def resolve_model(model_id: str) -> str:
    return MODEL_ALIASES.get(model_id, model_id or DEFAULT_MODEL)


def _wait_for_file_active(client: genai.Client, uploaded, timeout_sec: int = 120) -> None:
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


def _extract_text(response) -> str:
    text = response.text
    if not text:
        raise RuntimeError("Model returned empty output")
    return text.strip()


def _generate(
    client: genai.Client,
    *,
    model: str,
    contents: list,
    system_instruction: str,
    temperature: float,
) -> str:
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )
    return _extract_text(response)


def _upload_audio(client: genai.Client, audio_path: Path):
    uploaded = client.files.upload(file=str(audio_path))
    _wait_for_file_active(client, uploaded)
    return uploaded


def _transcribe_pass(
    client: genai.Client,
    uploaded,
    *,
    model: str,
    temperature: float,
    user_prompt: str | None,
) -> str:
    combined = load_combined_guidelines()
    user_text = TRANSCRIPTION_TASK.format(
        combined_guidelines=combined,
        user_instructions_block=_build_user_instructions_block(user_prompt),
    )
    return _generate(
        client,
        model=model,
        contents=[uploaded, user_text],
        system_instruction=TRANSCRIPTION_SYSTEM,
        temperature=temperature,
    )


def _structure_pass(
    client: genai.Client,
    uploaded,
    draft_lyrics: str,
    *,
    model: str,
    temperature: float,
    user_prompt: str | None,
) -> str:
    combined = load_combined_guidelines()
    user_text = STRUCTURE_TASK.format(
        draft_lyrics=draft_lyrics,
        combined_guidelines=combined,
        user_instructions_block=_build_user_instructions_block(user_prompt),
    )
    return _generate(
        client,
        model=model,
        contents=[uploaded, user_text],
        system_instruction=STRUCTURE_SYSTEM,
        temperature=temperature,
    )


def _single_pass(
    client: genai.Client,
    uploaded,
    *,
    model: str,
    temperature: float,
    user_prompt: str | None,
) -> str:
    web = load_web_guidelines()
    extended = load_extended_guidelines()
    user_text = USER_TASK_TEMPLATE.format(
        web_guidelines=web,
        extended_guidelines=extended,
        user_instructions_block=_build_user_instructions_block(user_prompt),
    )
    return _generate(
        client,
        model=model,
        contents=[uploaded, user_text],
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=temperature,
    )


def curate_audio(
    audio_path: Path,
    *,
    model: str = DEFAULT_MODEL,
    structure_model: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    api_key: str | None = None,
    user_prompt: str | None = None,
    split_structure: bool = True,
) -> tuple[str, list[str]]:
    """
    Curate lyrics from audio.

    Default: two-pass pipeline
      1) Transcription (user model) — lyrics only
      2) Structure tagging (deep model) — tags only, preserves words

    Returns (markdown, pipeline_steps).
    """
    client = _make_client(api_key)
    transcription_model = resolve_model(model)
    tagging_model = resolve_model(structure_model or MODEL_DEEP)

    uploaded = _upload_audio(client, audio_path)
    pipeline: list[str] = []

    try:
        if split_structure:
            draft = _transcribe_pass(
                client,
                uploaded,
                model=transcription_model,
                temperature=temperature,
                user_prompt=user_prompt,
            )
            pipeline.append("transcription")

            markdown = _structure_pass(
                client,
                uploaded,
                draft,
                model=tagging_model,
                temperature=temperature,
                user_prompt=user_prompt,
            )
            pipeline.append("structure")
        else:
            markdown = _single_pass(
                client,
                uploaded,
                model=transcription_model,
                temperature=temperature,
                user_prompt=user_prompt,
            )
            pipeline.append("single-pass")

        return markdown, pipeline
    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:
            pass
