import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import API_ROUTE_PREFIX, GROUNDING_DIR, IS_VERCEL, WEB_GUIDELINES_PATH
from app.routes.curate import router as curate_router
from app.services.temp_files import ensure_temp_dir

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Musica Curator API",
    description="Private Musixmatch-style lyrics curation via Gemini",
    version="1.0.0",
)

cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://musicaintelligence.vercel.app",
]
if vercel_url := os.getenv("VERCEL_URL"):
    cors_origins.append(f"https://{vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled API error")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error: {exc}"},
    )


ensure_temp_dir()
app.include_router(
    curate_router,
    prefix=API_ROUTE_PREFIX,
    tags=["curation"],
)


@app.get("/health")
def health():
    return {"status": "ok", "vercel": IS_VERCEL}


@app.get("/health/deep")
def health_deep():
    """Diagnostics for Vercel deploys (imports + grounding paths)."""
    checks: dict[str, str] = {"vercel": str(IS_VERCEL), "grounding_dir": str(GROUNDING_DIR)}
    try:
        checks["web_guidelines"] = (
            "ok" if WEB_GUIDELINES_PATH.is_file() else f"missing: {WEB_GUIDELINES_PATH}"
        )
    except Exception as exc:
        checks["web_guidelines"] = str(exc)
    try:
        from google import genai  # noqa: F401

        checks["google_genai"] = "ok"
    except Exception as exc:
        checks["google_genai"] = str(exc)
    ok = checks.get("web_guidelines") == "ok" and checks.get("google_genai") == "ok"
    return {"status": "ok" if ok else "degraded", "checks": checks}
