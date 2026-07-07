"""
Full analysis pipeline — orchestrates all stages for a brand.
Runs asynchronously as a background job.
"""

import asyncio
from database import (
    get_or_create_brand, save_ad, save_transcript,
    save_analysis, update_session, link_brand_to_client
)
from scraper import scrape_ads_for_brand
from downloader import download_video, get_video_url_for_frontend
from transcriber import transcribe_video
from analyzer import analyze_transcript


async def run_pipeline(brand_name: str, session_id: str, max_ads: int = 10,
                       client_id: str = None, role: str = "competitor",
                       reprocess: bool = False):
    """
    Full pipeline for one brand:
    1. Scrape ads from Meta Ad Library
    2. Download each video
    3. Transcribe audio
    4. AI analysis
    5. Save everything to Supabase
    """
    print(f"\n{'='*50}")
    print(f"[Pipeline] Starting for: {brand_name}")
    print(f"{'='*50}")

    try:
        # ── Stage 1: Scrape ──────────────────────────────
        update_session(session_id, {"status": "running"})
        print(f"[Pipeline] Stage 1 — Scraping Meta Ad Library...")
        ads_raw = await scrape_ads_for_brand(brand_name, max_ads=max_ads)
        print(f"[Pipeline] Found {len(ads_raw)} ads")

        if not ads_raw:
            update_session(session_id, {
                "status": "failed",
                "error_message": f"No video ads found on Meta Ad Library. Try a different URL or brand name."
            })
            return

        # If brand_name is a URL, use the actual page_name from scraped data
        if brand_name.startswith("http"):
            brand_name = ads_raw[0].get("page_name") or "Unknown Brand"
            print(f"[Pipeline] Resolved brand name from URL: {brand_name}")

        # ── Stage 2: Save brand & ads ────────────────────
        brand = get_or_create_brand(brand_name)
        brand_id = brand["id"]

        # Link brand to client workspace if this analysis belongs to one
        if client_id:
            try:
                link_brand_to_client(client_id, brand_id, role)
                print(f"[Pipeline] Linked '{brand_name}' to client {client_id} as {role}")
            except Exception as e:
                print(f"[Pipeline] client link warning: {e}")

        saved_ads = []
        for ad_raw in ads_raw:
            valid_cols = {
                "meta_library_id", "started_running_on", "days_running",
                "performance_tier", "platforms", "video_url", "thumbnail_url",
                "ad_copy", "status",
            }
            ad_data = {k: v for k, v in ad_raw.items() if k in valid_cols}
            saved = save_ad(brand_id, ad_data)
            saved_ads.append((saved, ad_raw))

        # ── Stages 3-5: Download → Transcribe → Analyze ──
        total = len(saved_ads)
        for i, (saved_ad, raw_ad) in enumerate(saved_ads):
            ad_id = saved_ad["id"]
            meta_id = raw_ad.get("meta_library_id", "")
            days_running = raw_ad.get("days_running", 0)
            video_url = raw_ad.get("video_url", "")

            print(f"\n[Pipeline] Ad {i+1}/{total} — {meta_id} ({days_running}d running)")

            # In reprocess mode, wipe old transcript+analysis so they regenerate
            if reprocess:
                from database import delete_transcript_and_analysis
                delete_transcript_and_analysis(ad_id)

            # Stage 3: Download (force re-download in reprocess mode)
            print(f"[Pipeline]   Downloading video...")
            local_path = download_video(video_url, brand_name, meta_id, force=reprocess)

            if local_path:
                # Update video_url to local path
                from database import supabase
                serve_url = get_video_url_for_frontend(local_path)
                supabase.table("ads").update({"video_url": serve_url}).eq("id", ad_id).execute()
            else:
                print(f"[Pipeline]   No video URL — skipping download")

            # Stage 4: Transcribe
            print(f"[Pipeline]   Transcribing...")
            transcript_data = transcribe_video(local_path) if local_path else {
                "full_text": "", "hook_text": "", "word_timestamps": [], "language": ""
            }
            saved_transcript = save_transcript(ad_id, transcript_data)
            print(f"[Pipeline]   Transcript: {len(transcript_data['full_text'])} chars")

            # Stage 5: AI Analysis
            print(f"[Pipeline]   Analyzing with Claude...")
            analysis = analyze_transcript(
                transcript=transcript_data["full_text"],
                hook_text=transcript_data["hook_text"],
                brand_name=brand_name,
                days_running=days_running
            )
            save_analysis(ad_id, analysis)
            print(f"[Pipeline]   Hook: '{analysis.get('hook', '')[:60]}'")

        # ── Done ─────────────────────────────────────────
        update_session(session_id, {
            "status": "completed",
            "total_ads_found": total,
            "brands_analyzed": [brand_name],
            "completed_at": "now()"
        })
        print(f"\n[Pipeline] DONE — {total} ads processed for {brand_name}")

    except Exception as e:
        print(f"[Pipeline] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        update_session(session_id, {
            "status": "failed",
            "error_message": str(e)
        })


async def run_single_ad_pipeline(url_or_id: str, session_id: str, client_id: str = None, role: str = "competitor"):
    """Process ONE specific ad by its Meta Ad Library link/ID."""
    from scraper import scrape_single_ad
    from database import supabase

    print(f"\n[SingleAd] Starting for: {url_or_id}")
    try:
        update_session(session_id, {"status": "running"})
        ad_raw = await scrape_single_ad(url_or_id)

        if not ad_raw:
            update_session(session_id, {
                "status": "failed",
                "error_message": "Could not find a video ad at that link. Make sure it's a Meta Ad Library video ad URL."
            })
            return

        # Use the actual advertiser brand if we extracted it ("Oolka"),
        # otherwise fall back to the page name (influencer/page that ran the ad).
        brand_name = ad_raw.get("advertiser_brand") or ad_raw.get("page_name") or "Unknown"
        brand = get_or_create_brand(brand_name)
        brand_id = brand["id"]

        valid_cols = {
            "meta_library_id", "started_running_on", "days_running",
            "performance_tier", "platforms", "video_url", "thumbnail_url",
            "ad_copy", "status",
        }
        ad_data = {k: v for k, v in ad_raw.items() if k in valid_cols}
        saved = save_ad(brand_id, ad_data)
        ad_id = saved["id"]
        meta_id = ad_raw["meta_library_id"]

        # Download
        print(f"[SingleAd] Downloading video...")
        local_path = download_video(ad_raw["video_url"], brand_name, meta_id, force=True)
        if local_path:
            serve_url = get_video_url_for_frontend(local_path)
            supabase.table("ads").update({"video_url": serve_url}).eq("id", ad_id).execute()

        # Transcribe
        print(f"[SingleAd] Transcribing...")
        from database import delete_transcript_and_analysis
        delete_transcript_and_analysis(ad_id)
        transcript_data = transcribe_video(local_path) if local_path else {
            "full_text": "", "hook_text": "", "word_timestamps": [], "language": ""
        }
        save_transcript(ad_id, transcript_data)

        # Analyze
        print(f"[SingleAd] Analyzing...")
        analysis = analyze_transcript(
            transcript=transcript_data["full_text"],
            hook_text=transcript_data["hook_text"],
            brand_name=brand_name,
            days_running=ad_raw.get("days_running", 0),
        )
        save_analysis(ad_id, analysis)

        # Link to client workspace if requested
        if client_id:
            from database import link_ad_to_client
            link_ad_to_client(client_id, ad_id, role)
            print(f"[SingleAd] Linked to client {client_id} as {role}")

        update_session(session_id, {
            "status": "completed",
            "total_ads_found": 1,
            "brands_analyzed": [brand_name],
            "completed_at": "now()",
        })
        print(f"[SingleAd] DONE — {brand_name} / {meta_id}")

    except Exception as e:
        print(f"[SingleAd] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        update_session(session_id, {"status": "failed", "error_message": str(e)})
