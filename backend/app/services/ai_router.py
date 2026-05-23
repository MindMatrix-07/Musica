from collections.abc import Iterator
from pathlib import Path
from typing import Any

from app.config import PROVIDER_GEMINI, PROVIDER_OPENAI
from app.services.gemini_curator import curate_audio_stream as gemini_stream
from app.services.training_context import parse_training_messages


def curate_audio_stream(
    audio_path: Path,
    *,
    provider: str = PROVIDER_GEMINI,
    gemini_api_key: str | None = None,
    openai_api_key: str | None = None,
    model: str = "gemini-3.5-flash",
    structure_model: str | None = None,
    temperature: float = 0.1,
    user_prompt: str | None = None,
    training_raw: str | None = None,
    split_structure: bool = True,
) -> Iterator[dict[str, Any]]:
    training = parse_training_messages(training_raw)
    provider = (provider or PROVIDER_GEMINI).lower()

    if provider == PROVIDER_OPENAI:
        if not openai_api_key:
            yield {
                "type": "error",
                "message": "OpenAI API key required. Add it in Settings.",
            }
            return
        from app.services.openai_curator import curate_audio_stream_openai

        yield from curate_audio_stream_openai(
            audio_path,
            api_key=openai_api_key,
            model=model,
            structure_model=structure_model,
            user_prompt=user_prompt,
            training_messages=training,
            split_structure=split_structure,
        )
        return

    if not gemini_api_key:
        yield {
            "type": "error",
            "message": "Gemini API key required. Add it in Settings.",
        }
        return

    yield from gemini_stream(
        audio_path,
        model=model,
        structure_model=structure_model,
        temperature=temperature,
        api_key=gemini_api_key,
        user_prompt=user_prompt,
        training_messages=training,
        split_structure=split_structure,
    )
