# Ad Intelligence — Project Guide

> Read this first. It's the single source of truth for how this project is built, run, and deployed. Keep it updated when architecture changes.

## What this is

An **Ad Intelligence portal** for Vidrow (a creative ad agency). It scrapes competitor + client ads from the **Meta Ad Library**, transcribes them, analyzes them with AI, and generates new video ad scripts for clients. Three script modes:
- **Fresh** — written from scratch using the full client context (brief + proven ads + competitor ads).
- **Adapted ("Copied")** — one winning ad rewritten for a client.
- **Doubled Down** — patterns from *multiple* winning ads fused into new scripts.

It also pulls **Instagram Reels** as inspiration and writes scripts from them.

## Architecture

```
Frontend (Next.js 15, App Router, TypeScript)  →  Backend (FastAPI, Python 3.9)  →  Supabase (Postgres)
        Vercel (planned)                              Railway/Render (planned)          shared project qyjquitdgwigqaljudfg
```

- **Frontend** talks to the backend via `NEXT_PUBLIC_API_URL`.
- **Backend** is a FastAPI app that also spawns long-running background jobs and serves downloaded videos as static files.
- **Database** is Supabase Postgres. NOTE: this Supabase project (`qyjquitdgwigqaljudfg`) is **shared with the Vidrow Portal** — different tables, same database.

## Running locally

```bash
./start.sh          # starts backend (:8001) + frontend (:3001)
```

Or individually:
```bash
# backend
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8001

# frontend
cd frontend && npm run dev -- --port 3001
```

- Backend: http://localhost:8001
- Frontend: http://localhost:3001

## Environment variables

**Backend** (`backend/.env` — gitignored, see `.env.example`):
- `SUPABASE_URL`, `SUPABASE_KEY` — Supabase project + anon key
- `ANTHROPIC_API_KEY` — Claude (script generation + ad analysis)
- `ELEVENLABS_API_KEY` — ElevenLabs Scribe (transcription)
- `VIDEO_STORAGE_PATH` — where videos are saved (`../videos` locally; a persistent disk path on a server)
- `ALLOWED_ORIGINS` — comma-separated CORS origins (add the Vercel URL in production)
- `META_ACCESS_TOKEN` — optional; blank = use Playwright scraper

**Frontend** (`frontend/.env.local` — gitignored):
- `NEXT_PUBLIC_API_URL` — backend URL (`http://localhost:8001` locally, Railway/Render URL in prod)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## External services (what does what)

| Service | Used for | Where |
|---|---|---|
| **Supabase** | Postgres database | all data |
| **Anthropic Claude** (`claude-sonnet-4-5`) | script generation + ad analysis | `script_generator.py`, `analyzer.py` |
| **ElevenLabs Scribe** | video transcription (all Indian languages + diarization) | `transcriber.py` |
| **Playwright (Chromium)** | scraping the Meta Ad Library | `scraper.py` |
| **yt-dlp** | downloading ad + Instagram reel videos | `downloader.py`, `instagram.py` |

## Backend files

- `main.py` — FastAPI app, all API routes, CORS, static video serving, launches background jobs
- `pipeline.py` — the scrape→download→transcribe→analyze orchestration
- `run_job.py` — entry point run as a **detached subprocess** by `main.py` for background jobs (can run for minutes)
- `scraper.py` — Playwright Meta Ad Library scraper
- `downloader.py` — video download (direct CDN + yt-dlp fallback)
- `instagram.py` — Instagram Reel download (yt-dlp)
- `transcriber.py` — ElevenLabs transcription
- `analyzer.py` — Claude ad analysis (hook, tone, hook_type)
- `script_generator.py` — Claude script generation (`generate_fresh_scripts`, adapted, doubledown)
- `database.py` — Supabase client + all DB helpers

## Data model highlights (Supabase)

- `ai_clients` — the agency's clients
- `brands` — scraped brands (client + competitors)
- `ads` — scraped ads (video_url, meta_library_id, days_running, linked to brand/client)
- `ai_analysis` — per-ad AI analysis (hook, tone, hook_type)
- `inspiration_reels` — Instagram reels saved as inspiration (reel_url, video_url)
- `ai_scripts` — generated scripts:
  - `type` — one of `adapted` | `doubledown` | `fresh` (DB CHECK constraint)
  - `ad_id` — **nullable** FK to `ads` (null for fresh + reel scripts)
  - `reel_id` — FK to `inspiration_reels` (set for scripts written from a reel)
  - `label`, `script_text`, `client_id`

## ⚠️ Gotchas — read before editing

1. **Transcription is ElevenLabs ONLY.** `transcriber.py` calls ElevenLabs Scribe via raw `requests`. Whisper/OpenAI was removed on purpose (dead files deleted). Do **not** reintroduce Whisper.
2. **Python 3.9 environment.** The venv is Python 3.9, so:
   - No `list[dict]` / `dict[str, int]` type hints → use plain `list`, `dict` or `typing.Optional`.
   - No backslashes inside f-string expressions → build those strings with concatenation (see `generate_fresh_scripts`).
3. **Script type constraint.** `ai_scripts.type` has a DB CHECK `IN ('adapted','doubledown','fresh')`. Adding a new type requires a migration. Reel scripts use `reel_id` (not `ad_id`).
4. **Instagram reel download needs a logged-in session.** `instagram.py` uses `yt-dlp --cookies-from-browser chrome`, which reads the Instagram login from the local Chrome app. **This only works on a machine with Chrome logged into Instagram** (i.e. locally). On a headless server it must be switched to a cookies file: `--cookies cookies.txt` (export cookies once, refresh when they expire). Instagram blocks un-authenticated downloads ("empty media response").
5. **Background jobs are detached subprocesses.** `main.py` → `run_job.py` runs in its own process group and can run for minutes. On a host that force-sleeps idle web services (e.g. Render free tier) a running job can be killed. Use a plan without forced sleep.
6. **Videos are stored on local disk** (`videos/`) and served at `/videos/...`. On deploy this needs a **persistent disk** (Railway volume / Render disk) or a move to **Supabase Storage** — otherwise videos vanish on redeploy. Transcripts + scripts are safe (they're in Supabase).
7. **`NEXT_PUBLIC_API_URL` must point at the deployed backend** for the Vercel build, otherwise the frontend calls `localhost`.

## Deployment (planned)

- **Backend → Railway** (or Render). Needs: Python 3.9, Playwright Chromium (`playwright install --with-deps chromium`), a persistent volume for `videos/`, no forced sleep. `backend/nixpacks.toml` is the Railway build config. Set all backend env vars + `ALLOWED_ORIGINS` = the Vercel URL.
- **Frontend → Vercel.** Root directory `frontend`. Set `NEXT_PUBLIC_API_URL` = backend URL.
- Deploy on the **company's own accounts** (GitHub/Railway/Vercel) to avoid ownership transfer later.

### Supabase migrations that were applied
```sql
ALTER TABLE ai_scripts ALTER COLUMN ad_id DROP NOT NULL;
ALTER TABLE ai_scripts ADD COLUMN IF NOT EXISTS reel_id UUID REFERENCES inspiration_reels(id) ON DELETE SET NULL;
ALTER TABLE ai_scripts DROP CONSTRAINT IF EXISTS ai_scripts_type_check;
ALTER TABLE ai_scripts ADD CONSTRAINT ai_scripts_type_check CHECK (type IN ('adapted','doubledown','fresh'));
```
