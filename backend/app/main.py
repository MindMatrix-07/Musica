import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_ROUTE_PREFIX
from app.routes.curate import router as curate_router
from app.services.temp_files import ensure_temp_dir

app = FastAPI(
    title="Musica Curator API",
    description="Private Musixmatch-style lyrics curation via Gemini",
    version="1.0.0",
)

cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
)

ensure_temp_dir()
app.include_router(
    curate_router,
    prefix=API_ROUTE_PREFIX,
    tags=["curation"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
