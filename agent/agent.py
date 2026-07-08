"""
Ad Intelligence Agent — runs on a team member's laptop.

What it does:
- Polls Supabase for scrape jobs (queued by the web frontend)
- For 'meta' jobs   → scrapes Meta Ad Library using Playwright on your home IP
                    → saves ads (with video CDN URLs) to Supabase
                    → calls backend to transcribe + analyze each ad
- For 'instagram'   → downloads the reel using yt-dlp + Chrome cookies
                    → sends video file to backend for transcription
                    → saves reel to Supabase

Run:  python agent.py
Stop: Ctrl+C
"""

import asyncio
import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
POLL_INTERVAL = 5  # seconds between job polls

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL and SUPABASE_KEY must be set in .env")
    sys.exit(1)

if not BACKEND_URL:
    print("❌ BACKEND_URL must be set in .env (e.g. https://your-app.onrender.com)")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ─── Job queue ────────────────────────────────────────────────────────────────

def claim_next_job():
    """Atomically claim the oldest queued job. Returns None if nothing is queued."""
    result = supabase.table("scrape_jobs").select("*").eq(
        "status", "queued"
    ).order("created_at").limit(1).execute()

    if not result.data:
        return None

    job = result.data[0]

    # Attempt atomic claim — only succeeds if still 'queued' (prevents double-processing)
    updated = supabase.table("scrape_jobs").update({
        "status": "running",
        "updated_at": "now()"
    }).eq("id", job["id"]).eq("status", "queued").execute()

    return updated.data[0] if updated.data else None


def mark_job(job_id: str, status: str, error: str = None):
    supabase.table("scrape_jobs").update({
        "status": status,
        "error_message": error,
        "updated_at": "now()"
    }).eq("id", job_id).execute()


# ─── Meta Ad Library ──────────────────────────────────────────────────────────

async def process_meta_job(job: dict):
    """
    Full Meta Ad Library pipeline:
    1. Scrape ads (Playwright, home IP → never blocked)
    2. Save ads to Supabase with their CDN video URLs
    3. Call backend to transcribe + analyze each ad
    """
    from scraper import scrape_ads_for_brand, scrape_single_ad

    params = job["params"]
    brand_name = params.get("brand_name", "").strip()
    max_ads = params.get("max_ads", 10)
    client_id = params.get("client_id")
    role = params.get("role", "competitor")
    session_id = params.get("session_id")

    # Detect single-ad URL (e.g. https://facebook.com/ads/library/?id=1234567890)
    # or a bare numeric ad ID
    is_single_ad = "?id=" in brand_name or brand_name.isdigit()

    print(f"\n🔍 Scraping Meta Ad Library: '{brand_name}' (max {max_ads} ads)")

    try:
        # ── Stage 1: Scrape ──────────────────────────────────────────────────
        if is_single_ad:
            print(f"🔗 Single-ad URL detected — using targeted scrape")
            single = await scrape_single_ad(brand_name)
            ads_raw = [single] if single else []
        else:
            ads_raw = await scrape_ads_for_brand(brand_name, max_ads=max_ads)

        if not ads_raw:
            err = "No video ads found. Try a different brand name or URL."
            print(f"⚠️  {err}")
            mark_job(job["id"], "error", err)
            if session_id:
                supabase.table("research_sessions").update({
                    "status": "failed", "error_message": err
                }).eq("id", session_id).execute()
            return

        # Resolve brand name if a URL was passed
        if brand_name.startswith("http"):
            brand_name = ads_raw[0].get("page_name") or "Unknown Brand"
            print(f"📛 Resolved brand name: {brand_name}")

        print(f"✅ Found {len(ads_raw)} ads for {brand_name}")

        # ── Stage 2: Save brand ──────────────────────────────────────────────
        existing = supabase.table("brands").select("id").ilike("name", brand_name).execute()
        if existing.data:
            brand_id = existing.data[0]["id"]
        else:
            brand = supabase.table("brands").insert({"name": brand_name}).execute()
            brand_id = brand.data[0]["id"]

        # Link brand to client workspace if requested
        if client_id:
            ex = supabase.table("ai_client_brands").select("id").eq(
                "client_id", client_id).eq("brand_id", brand_id).execute()
            if not ex.data:
                supabase.table("ai_client_brands").insert({
                    "client_id": client_id, "brand_id": brand_id, "role": role
                }).execute()

        # ── Stage 3: Save ads ────────────────────────────────────────────────
        valid_cols = {
            "meta_library_id", "started_running_on", "days_running",
            "performance_tier", "platforms", "video_url", "thumbnail_url",
            "ad_copy", "status",
        }
        saved_ad_ids = []

        for ad_raw in ads_raw:
            ad_data = {k: v for k, v in ad_raw.items() if k in valid_cols and v is not None}
            meta_id = ad_data.get("meta_library_id", "")

            existing_ad = supabase.table("ads").select("id").eq(
                "meta_library_id", meta_id).execute()

            if existing_ad.data:
                ad_id = existing_ad.data[0]["id"]
                supabase.table("ads").update({
                    "days_running": ad_data.get("days_running"),
                    "performance_tier": ad_data.get("performance_tier"),
                    "last_scraped_at": "now()"
                }).eq("id", ad_id).execute()
            else:
                row = supabase.table("ads").insert({
                    "brand_id": brand_id, **ad_data
                }).execute()
                ad_id = row.data[0]["id"]

            if ad_data.get("video_url"):
                saved_ad_ids.append(ad_id)

        print(f"💾 Saved {len(saved_ad_ids)} ads to Supabase")

        # ── Stage 4: Transcribe + Analyze via backend ────────────────────────
        for i, ad_id in enumerate(saved_ad_ids):
            print(f"🎙️  Transcribing ad {i+1}/{len(saved_ad_ids)}...")
            try:
                r = requests.post(
                    f"{BACKEND_URL}/api/transcribe/{ad_id}",
                    timeout=180
                )
                if r.status_code == 200:
                    print(f"🧠 Analyzing ad {i+1}/{len(saved_ad_ids)}...")
                    requests.post(f"{BACKEND_URL}/api/analyze/{ad_id}", timeout=60)
                else:
                    print(f"⚠️  Transcription failed for {ad_id[:8]}: {r.text[:100]}")
            except Exception as e:
                print(f"⚠️  Backend call error for {ad_id[:8]}: {e}")

        # ── Done ─────────────────────────────────────────────────────────────
        if session_id:
            supabase.table("research_sessions").update({
                "status": "completed",
                "total_ads_found": len(ads_raw),
                "brands_analyzed": [brand_name],
                "completed_at": "now()"
            }).eq("id", session_id).execute()

        mark_job(job["id"], "done")
        print(f"✅ Done — {brand_name} fully processed ({len(saved_ad_ids)} ads)\n")

    except Exception as e:
        import traceback
        traceback.print_exc()
        mark_job(job["id"], "error", str(e))
        if session_id:
            supabase.table("research_sessions").update({
                "status": "failed", "error_message": str(e)
            }).eq("id", session_id).execute()
        print(f"❌ Meta job failed: {e}")


# ─── Instagram Reels ──────────────────────────────────────────────────────────

def process_instagram_job(job: dict):
    """
    Instagram Reel pipeline:
    1. Download reel using yt-dlp + Chrome cookies (home IP + logged-in session)
    2. Send video file to backend for transcription
    3. Backend saves reel + transcript to Supabase
    """
    from instagram import download_reel

    params = job["params"]
    reel_url = params.get("reel_url", "").strip()
    client_id = params.get("client_id", "")

    print(f"\n📱 Downloading Instagram reel: {reel_url}")

    local_path = None
    try:
        dl = download_reel(reel_url)
        if not dl["success"]:
            raise Exception(dl.get("error", "yt-dlp download failed"))

        local_path = dl["local_path"]
        size_kb = Path(local_path).stat().st_size // 1024
        print(f"⬆️  Downloaded ({size_kb}KB), sending to backend for transcription...")

        with open(local_path, "rb") as f:
            response = requests.post(
                f"{BACKEND_URL}/api/instagram/transcribe",
                data={"reel_url": reel_url, "client_id": client_id},
                files={"file": (Path(local_path).name, f, "video/mp4")},
                timeout=180
            )

        if response.status_code not in (200, 201):
            raise Exception(f"Backend returned {response.status_code}: {response.text[:200]}")

        mark_job(job["id"], "done")
        print(f"✅ Instagram reel processed\n")

    except Exception as e:
        mark_job(job["id"], "error", str(e))
        print(f"❌ Instagram job failed: {e}")

    finally:
        if local_path:
            try:
                os.remove(local_path)
            except Exception:
                pass


# ─── Main loop ────────────────────────────────────────────────────────────────

async def main():
    print()
    print("=" * 52)
    print("  Ad Intelligence Agent")
    print("=" * 52)
    print(f"  Backend : {BACKEND_URL}")
    print(f"  Supabase: {SUPABASE_URL[:40]}...")
    print(f"  Polling every {POLL_INTERVAL}s for scrape jobs")
    print("=" * 52)
    print("  Press Ctrl+C to stop")
    print()

    while True:
        try:
            job = claim_next_job()
            if job:
                jtype = job.get("type", "unknown")
                print(f"📋 Job claimed: [{jtype}] (id: {job['id'][:8]}...)")
                if jtype == "meta":
                    await process_meta_job(job)
                elif jtype == "instagram":
                    process_instagram_job(job)
                else:
                    mark_job(job["id"], "error", f"Unknown job type: {jtype}")
            else:
                await asyncio.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n👋 Agent stopped.")
            break
        except Exception as e:
            print(f"⚠️  Unexpected error: {e}")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
