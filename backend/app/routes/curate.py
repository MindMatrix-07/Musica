import os
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.config import (
    ALLOWED_MIME_TYPES,
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    MAX_USER_PROMPT_CHARS,
    MODEL_DEEP,
    MODEL_FAST,
)
from app.services.audio_compress import cleanup_compressed, compress_audio_if_needed
from app.services.gemini_curator import curate_audio, curate_audio_stream, format_sse
from app.services.grounding import ensure_grounding_files
from app.services.temp_files import delete_file, purge_stale_temp, save_upload_transient

router = APIRouter()


def _resolve_api_key(header_key: str | None) -> str:
    key = (header_key or "").strip() or (os.getenv("GEMINI_API_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status_code=401,
            detail="Gemini API key required. Add it in Settings or set GEMINI_API_KEY on the server.",
        )
    return key


def _normalize_user_prompt(raw: str | None) -> str | None:
    text = (raw or "").strip()
    if not text:
        return None
    if len(text) > MAX_USER_PROMPT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Instructions must be {MAX_USER_PROMPT_CHARS} characters or fewer.",
        )
    return text


@router.post("/curate")
async def curate_endpoint(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL_FAST),
    temperature: float = Form(default=DEFAULT_TEMPERATURE),
    user_prompt: str = Form(default=""),
    split_structure: str = Form(default="true"),
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    """
    Accept audio upload, run Gemini curation, return markdown lyrics.
    Audio is stored only in a transient temp path and removed after processing.
    """
    purge_stale_temp()
    ensure_grounding_files()
    api_key = _resolve_api_key(x_gemini_api_key)
    prompt = _normalize_user_prompt(user_prompt)
    use_split = split_structure.lower() in {"true", "1", "yes", "on"}

    if model not in {MODEL_FAST, MODEL_DEEP, "gemini-3.5-flash", "gemini-1.5-pro"}:
        model = DEFAULT_MODEL

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        # Allow if extension is valid (browsers vary on MIME)
        ext = Path(file.filename or "").suffix.lower()
        if ext not in {".mp3", ".wav", ".webm", ".ogg"}:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported content type: {file.content_type}",
            )

    temp_path: Path | None = None
    audio_path: Path | None = None
    compressed = False
    try:
        temp_path = await save_upload_transient(file)
        audio_path, compressed = compress_audio_if_needed(temp_path)
        markdown, pipeline = curate_audio(
            audio_path,
            model=model,
            temperature=temperature,
            api_key=api_key,
            user_prompt=prompt,
            split_structure=use_split,
        )
        return {
            "markdown": markdown,
            "model": model,
            "temperature": temperature,
            "pipeline": pipeline,
            "split_structure": use_split,
            "compressed": compressed,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Curation failed: {e}") from e
    finally:
        if temp_path and audio_path:
            cleanup_compressed(audio_path, temp_path)
        if temp_path:
            delete_file(temp_path)


@router.post("/curate/stream")
async def curate_stream_endpoint(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL_FAST),
    temperature: float = Form(default=DEFAULT_TEMPERATURE),
    user_prompt: str = Form(default=""),
    split_structure: str = Form(default="true"),
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    """Server-Sent Events stream of live Gemini curation (Google AI Studio)."""
    purge_stale_temp()
    ensure_grounding_files()
    api_key = _resolve_api_key(x_gemini_api_key)
    prompt = _normalize_user_prompt(user_prompt)
    use_split = split_structure.lower() in {"true", "1", "yes", "on"}

    if model not in {MODEL_FAST, MODEL_DEEP, "gemini-3.5-flash", "gemini-1.5-pro"}:
        model = DEFAULT_MODEL

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in {".mp3", ".wav", ".webm", ".ogg"}:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported content type: {file.content_type}",
            )

    try:
        temp_path = await save_upload_transient(file)
        audio_path, compressed = compress_audio_if_needed(temp_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    def event_generator():
        try:
            if compressed:
                yield format_sse(
                    {
                        "type": "status",
                        "message": "Server compressed audio for upload",
                    }
                )
            for event in curate_audio_stream(
                audio_path,
                model=model,
                temperature=temperature,
                api_key=api_key,
                user_prompt=prompt,
                split_structure=use_split,
            ):
                if event.get("type") == "done":
                    event["compressed"] = compressed
                yield format_sse(event)
        except Exception as exc:
            yield format_sse({"type": "error", "message": str(exc)})
        finally:
            cleanup_compressed(audio_path, temp_path)
            delete_file(temp_path)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
