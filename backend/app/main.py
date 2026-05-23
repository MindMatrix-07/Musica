from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.curate import router as curate_router
from app.services.temp_files import ensure_temp_dir

app = FastAPI(
    title="Musica Curator API",
    description="Private Musixmatch-style lyrics curation via Gemini",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_temp_dir()
app.include_router(curate_router, prefix="/api", tags=["curation"])


@app.get("/health")
def health():
    return {"status": "ok"}
