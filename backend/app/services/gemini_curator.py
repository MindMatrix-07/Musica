import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

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


def _wait_for_file_active(
    client: genai.Client,
    uploaded,
    *,
    timeout_sec: int = 120,
) -> Iterator[dict[str, Any]]:
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
        yield {
            "type": "status",
            "message": f"Google AI Studio: processing audio ({state_name})…",
        }
        time.sleep(2)
    raise TimeoutError(f"Timed out waiting for file to become ACTIVE: {name}")


def _make_client(api_key: str | None) -> genai.Client:
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client()


def _stream_generate(
    client: genai.Client,
    *,
    model: str,
    contents: list,
    system_instruction: str,
    temperature: float,
) -> Iterator[str]:
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    ):
        if chunk.text:
            yield chunk.text


def curate_audio_stream(
    audio_path: Path,
    *,
    model: str = DEFAULT_MODEL,
    structure_model: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    api_key: str | None = None,
    user_prompt: str | None = None,
    split_structure: bool = True,
) -> Iterator[dict[str, Any]]:
    """Yield event dicts for live Gemini curation (Google AI Studio streaming)."""
    client = _make_client(api_key)
    transcription_model = resolve_model(model)
    tagging_model = resolve_model(structure_model or MODEL_DEEP)
    pipeline: list[str] = []
    uploaded = None
    markdown = ""

    try:
        yield {"type": "status", "message": "Connecting to Google AI Studio…"}

        yield {"type": "status", "message": "Uploading audio to Gemini Files API…"}
        uploaded = client.files.upload(file=str(audio_path))

        for status_evt in _wait_for_file_active(client, uploaded):
            yield status_evt

        yield {"type": "status", "message": "Audio ready — streaming curation"}

        if split_structure:
            combined = load_combined_guidelines()
            tx_prompt = TRANSCRIPTION_TASK.format(
                combined_guidelines=combined,
                user_instructions_block=_build_user_instructions_block(user_prompt),
            )
            yield {
                "type": "pass_start",
                "pass": "transcription",
                "model": transcription_model,
                "message": f"Pass 1 · Lyrics transcription ({transcription_model})",
            }

            tx_parts: list[str] = []
            for piece in _stream_generate(
                client,
                model=transcription_model,
                contents=[uploaded, tx_prompt],
                system_instruction=TRANSCRIPTION_SYSTEM,
                temperature=temperature,
            ):
                tx_parts.append(piece)
                yield {"type": "chunk", "pass": "transcription", "text": piece}

            draft = "".join(tx_parts).strip()
            if not draft:
                raise RuntimeError("Transcription pass returned empty output")
            pipeline.append("transcription")
            yield {"type": "pass_end", "pass": "transcription"}

            struct_prompt = STRUCTURE_TASK.format(
                draft_lyrics=draft,
                combined_guidelines=combined,
                user_instructions_block=_build_user_instructions_block(user_prompt),
            )
            yield {
                "type": "pass_start",
                "pass": "structure",
                "model": tagging_model,
                "message": f"Pass 2 · Structure tagging ({tagging_model})",
            }

            st_parts: list[str] = []
            for piece in _stream_generate(
                client,
                model=tagging_model,
                contents=[uploaded, struct_prompt],
                system_instruction=STRUCTURE_SYSTEM,
                temperature=temperature,
            ):
                st_parts.append(piece)
                yield {"type": "chunk", "pass": "structure", "text": piece}

            markdown = "".join(st_parts).strip()
            if not markdown:
                raise RuntimeError("Structure pass returned empty output")
            pipeline.append("structure")
            yield {"type": "pass_end", "pass": "structure"}
        else:
            web = load_web_guidelines()
            extended = load_extended_guidelines()
            user_text = USER_TASK_TEMPLATE.format(
                web_guidelines=web,
                extended_guidelines=extended,
                user_instructions_block=_build_user_instructions_block(user_prompt),
            )
            yield {
                "type": "pass_start",
                "pass": "single-pass",
                "model": transcription_model,
                "message": f"Single-pass curation ({transcription_model})",
            }
            parts: list[str] = []
            for piece in _stream_generate(
                client,
                model=transcription_model,
                contents=[uploaded, user_text],
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=temperature,
            ):
                parts.append(piece)
                yield {"type": "chunk", "pass": "single-pass", "text": piece}
            markdown = "".join(parts).strip()
            if not markdown:
                raise RuntimeError("Model returned empty output")
            pipeline.append("single-pass")
            yield {"type": "pass_end", "pass": "single-pass"}

        yield {
            "type": "done",
            "markdown": markdown,
            "pipeline": pipeline,
            "model": model,
            "temperature": temperature,
            "split_structure": split_structure,
        }
    except Exception as exc:
        yield {"type": "error", "message": str(exc)}
    finally:
        if uploaded:
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                pass


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
    markdown = ""
    pipeline: list[str] = []
    for event in curate_audio_stream(
        audio_path,
        model=model,
        structure_model=structure_model,
        temperature=temperature,
        api_key=api_key,
        user_prompt=user_prompt,
        split_structure=split_structure,
    ):
        if event.get("type") == "done":
            markdown = event["markdown"]
            pipeline = event.get("pipeline", [])
    if not markdown:
        raise RuntimeError("Curation produced no output")
    return markdown, pipeline


def format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
