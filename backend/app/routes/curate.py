from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import (
    ALLOWED_MIME_TYPES,
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    MODEL_DEEP,
    MODEL_FAST,
)
from app.services.gemini_curator import curate_audio
from app.services.grounding import ensure_grounding_files
from app.services.temp_files import delete_file, purge_stale_temp, save_upload_transient

router = APIRouter()


@router.post("/curate")
async def curate_endpoint(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL_FAST),
    temperature: float = Form(default=DEFAULT_TEMPERATURE),
):
    """
    Accept audio upload, run Gemini curation, return markdown lyrics.
    Audio is stored only in a transient temp path and removed after processing.
    """
    purge_stale_temp()
    ensure_grounding_files()

    if model not in {MODEL_FAST, MODEL_DEEP, "gemini-3.5-flash", "gemini-1.5-pro"}:
        model = DEFAULT_MODEL

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        # Allow if extension is valid (browsers vary on MIME)
        ext = Path(file.filename or "").suffix.lower()
        if ext not in {".mp3", ".wav"}:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported content type: {file.content_type}",
            )

    temp_path: Path | None = None
    try:
        temp_path = await save_upload_transient(file)
        markdown = curate_audio(
            temp_path,
            model=model,
            temperature=temperature,
        )
        return {
            "markdown": markdown,
            "model": model,
            "temperature": temperature,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Curation failed: {e}") from e
    finally:
        if temp_path:
            delete_file(temp_path)
