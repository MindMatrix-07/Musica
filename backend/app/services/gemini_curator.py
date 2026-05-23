import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from app.config import DEFAULT_TEMPERATURE, MODEL_DEEP, MODEL_FAST
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
from app.services.model_resolve import display_model, resolve_api_models, resolve_structure_model
from app.services.training_context import build_training_block


def _build_extras(user_prompt: str | None, training_messages: list[str] | None) -> tuple[str, str]:
    training_block = build_training_block(training_messages or [])
    user_block = ""
    text = (user_prompt or "").strip()
    if text:
        user_block = USER_INSTRUCTIONS_BLOCK.format(user_prompt=text)
    return training_block, user_block


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


def _stream_generate(
    client: genai.Client,
    *,
    model_candidates: list[str],
    contents: list,
    system_instruction: str,
    temperature: float,
) -> Iterator[str]:
    last_error: Exception | None = None
    for model in model_candidates:
        try:
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
            return
        except Exception as exc:
            last_error = exc
            continue
    if last_error:
        raise last_error
    raise RuntimeError("No models available for generation")


def curate_audio_stream(
    audio_path: Path,
    *,
    model: str = MODEL_FAST,
    structure_model: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    api_key: str | None = None,
    user_prompt: str | None = None,
    training_messages: list[str] | None = None,
    split_structure: bool = True,
) -> Iterator[dict[str, Any]]:
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    tx_label = display_model(model)
    tag_label = display_model(resolve_structure_model(structure_model))
    tx_api_models = resolve_api_models(model)
    tag_api_models = resolve_api_models(resolve_structure_model(structure_model))
    training_block, user_block = _build_extras(user_prompt, training_messages)
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
                training_block=training_block,
                user_instructions_block=user_block,
            )
            yield {
                "type": "pass_start",
                "pass": "transcription",
                "model": tx_label,
                "message": f"Pass 1 · Lyrics transcription ({tx_label})",
            }

            tx_parts: list[str] = []
            for piece in _stream_generate(
                client,
                model_candidates=tx_api_models,
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
            yield {"type": "pass_end", "pass": "transcription", "draft": draft}

            struct_prompt = STRUCTURE_TASK.format(
                draft_lyrics=draft,
                combined_guidelines=combined,
                training_block=training_block,
                user_instructions_block=user_block,
            )
            yield {
                "type": "pass_start",
                "pass": "structure",
                "model": tag_label,
                "message": f"Pass 2 · Structure tagging ({tag_label})",
            }

            st_parts: list[str] = []
            for piece in _stream_generate(
                client,
                model_candidates=tag_api_models,
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
                training_block=training_block,
                user_instructions_block=user_block,
            )
            yield {
                "type": "pass_start",
                "pass": "single-pass",
                "model": tx_label,
                "message": f"Single-pass curation ({tx_label})",
            }
            parts: list[str] = []
            for piece in _stream_generate(
                client,
                model_candidates=tx_api_models,
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
            yield {"type": "pass_end", "pass": "single-pass", "draft": markdown}

        yield {
            "type": "done",
            "markdown": markdown,
            "pipeline": pipeline,
            "model": model,
            "temperature": temperature,
            "split_structure": split_structure,
            "provider": "gemini",
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
    **kwargs,
) -> tuple[str, list[str]]:
    markdown = ""
    pipeline: list[str] = []
    for event in curate_audio_stream(audio_path, **kwargs):
        if event.get("type") == "done":
            markdown = event["markdown"]
            pipeline = event.get("pipeline", [])
    if not markdown:
        raise RuntimeError("Curation produced no output")
    return markdown, pipeline


def format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
