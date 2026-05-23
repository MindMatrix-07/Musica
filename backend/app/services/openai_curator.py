"""OpenAI provider — optional alternative to Gemini."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from openai import OpenAI

from app.config import MODEL_DEEP, MODEL_FAST
from app.prompts import (
    STRUCTURE_SYSTEM,
    STRUCTURE_TASK,
    TRANSCRIPTION_SYSTEM,
    TRANSCRIPTION_TASK,
    USER_INSTRUCTIONS_BLOCK,
)
from app.services.grounding import load_combined_guidelines
from app.services.model_resolve import display_model, resolve_structure_model
from app.services.training_context import build_training_block


def _build_user_block(user_prompt: str | None, training: list[str]) -> str:
    parts = [build_training_block(training)]
    text = (user_prompt or "").strip()
    if text:
        parts.append(USER_INSTRUCTIONS_BLOCK.format(user_prompt=text))
    return "".join(parts)


def _stream_chat(
    client: OpenAI,
    *,
    model: str,
    system: str,
    user: str,
) -> Iterator[str]:
    stream = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def curate_audio_stream_openai(
    audio_path: Path,
    *,
    api_key: str,
    model: str = MODEL_FAST,
    structure_model: str | None = None,
    user_prompt: str | None = None,
    training_messages: list[str] | None = None,
    split_structure: bool = True,
) -> Iterator[dict[str, Any]]:
    client = OpenAI(api_key=api_key)
    training = training_messages or []
    tx_model = "gpt-4o"
    tag_model = "gpt-4o"
    tx_label = display_model(model)
    tag_label = display_model(resolve_structure_model(structure_model))
    pipeline: list[str] = []
    markdown = ""

    try:
        yield {"type": "status", "message": "Connecting to OpenAI…"}
        yield {"type": "status", "message": "OpenAI: transcribing audio (Whisper)…"}

        with audio_path.open("rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )

        draft = (transcript.text or "").strip()
        if not draft:
            raise RuntimeError("Whisper returned empty transcription")

        if not split_structure:
            pipeline.append("single-pass")
            yield {
                "type": "pass_start",
                "pass": "single-pass",
                "model": tx_label,
                "message": f"OpenAI transcription ({tx_label})",
            }
            for i in range(0, len(draft), 80):
                yield {"type": "chunk", "pass": "single-pass", "text": draft[i : i + 80]}
            yield {"type": "pass_end", "pass": "single-pass", "draft": draft}
            markdown = draft
        else:
            combined = load_combined_guidelines()
            extra = _build_user_block(user_prompt, training)

            yield {
                "type": "pass_start",
                "pass": "transcription",
                "model": tx_label,
                "message": f"Pass 1 · Lyrics ({tx_label} via Whisper)",
            }
            for i in range(0, len(draft), 80):
                yield {"type": "chunk", "pass": "transcription", "text": draft[i : i + 80]}
            pipeline.append("transcription")
            yield {"type": "pass_end", "pass": "transcription", "draft": draft}

            struct_user = STRUCTURE_TASK.format(
                draft_lyrics=draft,
                combined_guidelines=combined,
                training_block=build_training_block(training),
                user_instructions_block=(
                    USER_INSTRUCTIONS_BLOCK.format(user_prompt=user_prompt)
                    if (user_prompt or "").strip()
                    else ""
                ),
            )
            yield {
                "type": "pass_start",
                "pass": "structure",
                "model": tag_label,
                "message": f"Pass 2 · Structure tags ({tag_label})",
            }

            parts: list[str] = []
            for piece in _stream_chat(
                client,
                model=tag_model,
                system=STRUCTURE_SYSTEM,
                user=struct_user,
            ):
                parts.append(piece)
                yield {"type": "chunk", "pass": "structure", "text": piece}

            markdown = "".join(parts).strip()
            if not markdown:
                raise RuntimeError("OpenAI structure pass returned empty output")
            pipeline.append("structure")
            yield {"type": "pass_end", "pass": "structure"}

        yield {
            "type": "done",
            "markdown": markdown,
            "pipeline": pipeline,
            "model": model,
            "temperature": 0.1,
            "split_structure": split_structure,
            "provider": "openai",
        }
    except Exception as exc:
        yield {"type": "error", "message": str(exc)}
