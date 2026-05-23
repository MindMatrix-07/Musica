# Musica — Music Transcription & AI Curation

Private internal tool to upload audio, apply **Musixmatch** curation policies via Gemini, and output structured markdown lyrics.

- **Backend:** FastAPI + `google-genai`
- **Frontend:** Next.js 15 + Tailwind (dark premium UI)
- **Storage:** Transient local temp files only (deleted after each request)

Official references:

- [Musixmatch Community Guidelines](https://community.musixmatch.com/guidelines?lng=en)
- [Extended Guidelines (Google Doc)](https://docs.google.com/document/d/1njyoifp2cyG-IQu0495eX1Mo0Hp2qy-vl4IeHX0DSCw/preview?tab=t.0#heading=h.6sjztjb91eku)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Python 3.11+ | For the API |
| Node.js 20+ | For the dashboard |
| [Gemini API key](https://aistudio.google.com/apikey) | Free tier works; set as `GEMINI_API_KEY` |

---

## 1. Backend setup

```powershell
cd c:\Users\HP\Documents\Musica\backend

py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt

# Create placeholder extended PDF (replace with official export later)
python scripts\generate_extended_pdf.py

# Copy env and add your key
copy .env.example .env
# Edit .env → GEMINI_API_KEY=...
```

Load `GEMINI_API_KEY` into the shell (PowerShell):

```powershell
$env:GEMINI_API_KEY = "your_key_here"
```

### Smoke test (optional)

```powershell
python scripts\test_gemini_upload.py "C:\path\to\track.mp3"
```

### Run API

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check: http://127.0.0.1:8000/health

---

## 2. Frontend setup

New terminal:

```powershell
cd c:\Users\HP\Documents\Musica\frontend

npm install

copy .env.local.example .env.local
# Default BACKEND_URL=http://127.0.0.1:8000

npm run dev
```

Open http://localhost:3000

---

## 3. How to use

1. Open the dashboard.
2. Drag & drop an **MP3** or **WAV** (≤ 50 MB).
3. Toggle **gemini-3.5-flash** (fast) vs **gemini-1.5-pro** (deep reasoning).
4. Processing runs automatically; progress bar shows upload/API work.
5. Review **playback** (left) and **markdown lyrics** (right) with `[Chorus]`-style badges.

Re-run with the same file after changing the model toggle.

---

## Grounding files

| File | Purpose |
|------|---------|
| `backend/grounding/musixmatch_web_guidelines.txt` | Web guidelines summary |
| `backend/grounding/musixmatch_extended_guidelines.pdf` | Extended policy (placeholder PDF generated; **replace** with export from the Google Doc) |
| `backend/grounding/musixmatch_extended_guidelines.txt` | Fallback if PDF missing/unreadable |

Replace the PDF with your official extended export for production accuracy.

---

## API

`POST /api/curate` (multipart)

| Field | Type | Default |
|-------|------|---------|
| `file` | audio file | required |
| `model` | `gemini-3.5-flash` \| `gemini-1.5-pro` | `gemini-3.5-flash` |
| `temperature` | float | `0.1` |

Response:

```json
{
  "markdown": "...",
  "model": "gemini-3.5-flash",
  "temperature": 0.1
}
```

The UI model IDs map to current Gemini API names (`gemini-2.5-flash`, `gemini-2.5-pro`) in `backend/app/config.py` if Google renames endpoints. Adjust `MODEL_ALIASES` when new model IDs ship.

---

## Security notes

- Uploads land in `backend/tmp_uploads/` with random names and are **deleted in a `finally` block** after curation.
- Gemini uploaded files are **deleted** after inference.
- API key stays **server-side only** (never exposed to the browser).
- CORS is limited to local Next.js dev origins.

---

## Project layout

```
Musica/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── prompts.py          # Immutable system instruction
│   │   ├── routes/curate.py
│   │   └── services/
│   ├── grounding/
│   ├── scripts/
│   └── requirements.txt
└── frontend/
    ├── app/
    └── components/
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `GEMINI_API_KEY` not set | Export in PowerShell or add to `backend/.env` and restart uvicorn |
| Model not found | Update `MODEL_ALIASES` in `config.py` to valid model IDs from [Google AI models](https://ai.google.dev/gemini-api/docs/models) |
| CORS / network error | Ensure backend on `:8000` and `BACKEND_URL` in `.env.local` |
| Large file rejected | Max 50 MB; use compressed MP3 |
| Empty lyrics | Retry with `gemini-1.5-pro`; check audio has clear vocals |

---

## UI overview

- **Music player first** — upload, listen, then curate from the hero player
- **Live feed** — streams Gemini status and tokens via `/api/curate/stream` (Google AI Studio SSE)
- **Copy lyrics** — one-click copy on the lyrics panel

## Two-pass curation (recommended)

Gemini is strong at **lyric transcription** but weaker at **structure tagging**. Musica uses:

| Pass | Model | Task |
|------|--------|------|
| 1 — Transcription | Your toggle (Flash/Pro) | Hear audio, write lyric lines only (no `[Verse]` tags) |
| 2 — Structure | Gemini Pro (`gemini-2.5-pro`) | Hear audio + read draft; add `[Intro]`, `[Chorus]`, `#INSTRUMENTAL` only — **no word changes** |

Both passes load **web + extended** Musixmatch guidelines together.

Toggle **Split structure tagging** in the UI (on by default).

### Is there a dedicated “structure tagging” API?

There is no widely used public API that only tags Musixmatch-style sections. Practical options:

- **This app’s Pass 2** — structure-only Gemini call with strict prompts (implemented).
- **Audio segmentation** (librosa, etc.) — detects breaks, not lyric-aware `[Verse]` semantics.
- **Future** — plug in another LLM endpoint as `structure_model` if you add one.

## Audio compression

Files over **~3.5 MB** are re-encoded in the **browser** (mono MP3, lower bitrate) before upload so Vercel’s body limit is respected. The server also attempts compression via `pydub` when `ffmpeg` is available (local/Railway).

---

## Deploy on Vercel (multi-service)

This repo uses **[Vercel Services](https://vercel.com/docs/services)** via root `vercel.json`:

| Service | Path | Entry |
|---------|------|--------|
| **frontend** | `/` | `frontend/` (Next.js) |
| **backend** | `/api` | `backend/app/main.py` (FastAPI, deps via `backend/requirements.txt`) |

### Steps

1. Import https://github.com/MindMatrix-07/Musica in [Vercel](https://vercel.com).
2. Leave **Root Directory** as the repository root (`.`).
3. In project **Settings → General → Framework**, set framework to **Services** (required when `experimentalServices` is present).
4. Add environment variable **`GEMINI_API_KEY`** (Production + Preview).
5. Deploy. The dashboard calls `/api/curate` on the same domain; no `BACKEND_URL` needed.

### Local dev with both services

```powershell
npm i -g vercel
cd c:\Users\HP\Documents\Musica
vercel dev -L
```

`vercel dev -L` runs frontend and FastAPI together with the same routing as production.

### Optional: external API only

If you host the API elsewhere, set `BACKEND_URL` in Vercel and use a separate frontend-only deploy (Root Directory = `frontend`).

**Note:** Vercel serverless has a ~4.5 MB request body limit on Hobby; large audio files may need a paid plan or external API hosting.

---

## Free tier tips

- Shorter clips consume fewer tokens and upload faster.
- `gemini-3.5-flash` is best for iteration; switch to `gemini-1.5-pro` for dense arrangements.
- Rate limits apply; wait between rapid re-runs if you hit 429 errors.
