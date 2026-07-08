"""
FastAPI backend for Ad Intelligence Tool.

In the hybrid architecture:
- This backend handles: transcription, AI analysis, script generation, all data reads/writes
- The local agent (agent/agent.py) handles: Meta scraping, Instagram downloads
- Scrape jobs are queued in Supabase (scrape_jobs table) for the agent to pick up
"""

import os
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from database import (
    create_session, get_sessions, get_all_ads_with_details,
    create_client, list_clients, get_client, get_client_ads,
    get_clients_dashboard, get_dashboard_stats, get_top_ads,
    link_existing_brand, list_all_brands, link_ad_to_client,
    supabase
)

load_dotenv()

app = FastAPI(title="Ad Intelligence API", version="2.0.0")

_default_origins = "http://localhost:3000,http://localhost:3001,http://localhost:3002"
_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Videos are served directly from Meta/Instagram CDN URLs stored in Supabase.
# No local video storage or static file serving needed on this backend.


# ── Request/Response Models ───────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    brand_name: str          # now accepts a Meta Ad Library URL or a brand name
    max_ads: int = 10
    client_id: Optional[str] = None
    role: str = "competitor"


class AnalyzeResponse(BaseModel):
    session_id: str
    message: str


class CreateClientRequest(BaseModel):
    name: str


class AnalyzeUrlRequest(BaseModel):
    ad_url: str
    client_id: Optional[str] = None
    role: str = "competitor"


class LinkBrandRequest(BaseModel):
    brand_name: str
    role: str = "competitor"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "Ad Intelligence API is running"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def start_analysis(request: AnalyzeRequest):
    """
    Queue a Meta Ad Library scrape for the local agent.
    Creates a research session (for progress tracking) + a scrape_job (for the agent).
    Poll /api/sessions/{session_id} for status — the agent updates it when done.
    """
    brand_name = request.brand_name.strip()
    if not brand_name:
        raise HTTPException(status_code=400, detail="brand_name is required")

    session = create_session(brand_name, client_id=request.client_id)
    session_id = session["id"]

    # Create job for the agent to pick up
    supabase.table("scrape_jobs").insert({
        "type": "meta",
        "status": "queued",
        "params": {
            "brand_name": brand_name,
            "max_ads": request.max_ads,
            "client_id": request.client_id,
            "role": request.role,
            "session_id": session_id,
        }
    }).execute()

    return AnalyzeResponse(
        session_id=session_id,
        message=f"Scrape job queued for '{brand_name}'. Agent will process it. Poll /api/sessions/{session_id} for status."
    )


@app.post("/api/analyze-url", response_model=AnalyzeResponse)
async def analyze_single_url(request: AnalyzeUrlRequest):
    """Queue a single Meta Ad Library URL for scraping by the agent."""
    ad_url = request.ad_url.strip()
    if not ad_url:
        raise HTTPException(status_code=400, detail="ad_url is required")

    session = create_session(f"[link] {ad_url}")
    session_id = session["id"]

    supabase.table("scrape_jobs").insert({
        "type": "meta",
        "status": "queued",
        "params": {
            "brand_name": ad_url,
            "max_ads": 1,
            "client_id": request.client_id,
            "role": request.role,
            "session_id": session_id,
        }
    }).execute()

    return AnalyzeResponse(session_id=session_id, message="Single ad scrape queued for agent.")


# ── Job queue routes (for agent + frontend polling) ───────────────────────────

@app.post("/api/jobs")
def create_job(body: dict):
    """Create a scrape job for the local agent to pick up."""
    job_type = body.get("type")
    params = body.get("params", {})
    if job_type not in ("meta", "instagram"):
        raise HTTPException(status_code=400, detail="type must be 'meta' or 'instagram'")
    row = supabase.table("scrape_jobs").insert({
        "type": job_type,
        "params": params,
        "status": "queued"
    }).execute()
    return row.data[0]


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    """Get status of a scrape job (frontend polls this to know when agent is done)."""
    result = supabase.table("scrape_jobs").select("*").eq("id", job_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return result.data[0]


# ── Transcription + Analysis (called by agent after saving ads) ───────────────

@app.post("/api/transcribe/{ad_id}")
def transcribe_ad(ad_id: str):
    """
    Download ad video from its CDN URL and transcribe with ElevenLabs.
    Called by the agent after saving ads to Supabase.
    Also available for manual re-transcription from the frontend.
    """
    from transcriber import transcribe_from_url
    from database import save_transcript, delete_transcript_and_analysis

    ad = supabase.table("ads").select("video_url").eq("id", ad_id).execute().data
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")

    video_url = ad[0].get("video_url", "")
    if not video_url or video_url.startswith("/videos/"):
        raise HTTPException(status_code=400, detail="No valid CDN video URL for this ad")

    delete_transcript_and_analysis(ad_id)
    transcript_data = transcribe_from_url(video_url, ad_id)
    save_transcript(ad_id, transcript_data)

    return {"status": "done", "chars": len(transcript_data.get("full_text", ""))}


@app.post("/api/analyze/{ad_id}")
def analyze_ad(ad_id: str):
    """
    Run Claude analysis on a transcribed ad.
    Called by the agent after transcription, or manually from the frontend.
    """
    from analyzer import analyze_transcript
    from database import save_analysis

    row = supabase.table("ads").select(
        "days_running, brands(name), transcripts(full_text, hook_text)"
    ).eq("id", ad_id).execute().data
    if not row:
        raise HTTPException(status_code=404, detail="Ad not found")
    ad = row[0]

    transcript = (ad.get("transcripts") or {}).get("full_text", "")
    hook = (ad.get("transcripts") or {}).get("hook_text", "")
    brand_name = (ad.get("brands") or {}).get("name", "")

    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript — transcribe the ad first")

    analysis = analyze_transcript(
        transcript=transcript,
        hook_text=hook,
        brand_name=brand_name,
        days_running=ad.get("days_running", 0)
    )
    save_analysis(ad_id, analysis)
    return {"status": "done", "analysis": analysis}


# ── Client workspace routes ───────────────────────────────────────────────────

@app.post("/api/clients")
def create_client_route(request: CreateClientRequest):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    return create_client(name)


@app.get("/api/clients")
def list_clients_route():
    return list_clients()


@app.get("/api/dashboard")
def dashboard_route(client_id: str = None):
    """Analytics dashboard — optionally filtered by client_id."""

    clients_raw = get_clients_dashboard()
    client_ids = [client_id] if client_id else [c["id"] for c in clients_raw]

    def q_scripts(cids):
        rows = supabase.table("ai_scripts").select("id, type, client_id, reel_id, created_at").execute().data
        return [r for r in rows if r["client_id"] in cids]

    def q_client_ads(cids):
        rows = supabase.table("ai_client_ads").select("id, client_id, role, created_at").execute().data
        return [r for r in rows if r["client_id"] in cids]

    def q_reels(cids):
        rows = supabase.table("inspiration_reels").select("id, client_id, created_at").execute().data
        return [r for r in rows if r["client_id"] in cids]

    scripts = q_scripts(client_ids)
    client_ads = q_client_ads(client_ids)
    reels = q_reels(client_ids)

    # ── Box 1: Meta Ads Scraped ──
    brand_ads = [a for a in client_ads if a.get("role") == "client"]
    competitor_ads = [a for a in client_ads if a.get("role") == "competitor"]

    # brand breakdown per client
    brand_breakdown = []
    for c in clients_raw:
        if c["id"] not in client_ids:
            continue
        c_brand = sum(1 for a in client_ads if a["client_id"] == c["id"] and a.get("role") == "client")
        c_comp = sum(1 for a in client_ads if a["client_id"] == c["id"] and a.get("role") == "competitor")
        if c_brand + c_comp > 0:
            brand_breakdown.append({
                "client": c["name"],
                "client_id": c["id"],
                "brand_ads": c_brand,
                "competitor_ads": c_comp,
            })

    # ── Box 2: Scripts Made ──
    fresh = [s for s in scripts if s["type"] == "fresh"]
    copied = [s for s in scripts if s["type"] == "adapted" and not s.get("reel_id")]
    doubled = [s for s in scripts if s["type"] == "doubledown"]
    reel_scripts = [s for s in scripts if s.get("reel_id")]

    # ── Box 3: Instagram Reels ──
    reel_ids_with_scripts = {s["reel_id"] for s in reel_scripts if s.get("reel_id")}

    # ── Box 4: Per-client summary ──
    per_client = []
    for c in clients_raw:
        cid = c["id"]
        if cid not in client_ids:
            continue
        c_scripts = [s for s in scripts if s["client_id"] == cid]
        c_reels = [r for r in reels if r["client_id"] == cid]
        c_ads = [a for a in client_ads if a["client_id"] == cid]
        per_client.append({
            "client_id": cid,
            "client_name": c["name"],
            "total_ads": len(c_ads),
            "brand_ads": sum(1 for a in c_ads if a.get("role") == "client"),
            "competitor_ads": sum(1 for a in c_ads if a.get("role") == "competitor"),
            "fresh_scripts": sum(1 for s in c_scripts if s["type"] == "fresh"),
            "copied_scripts": sum(1 for s in c_scripts if s["type"] == "adapted" and not s.get("reel_id")),
            "doubled_scripts": sum(1 for s in c_scripts if s["type"] == "doubledown"),
            "reels": len(c_reels),
            "reel_scripts": sum(1 for s in c_scripts if s.get("reel_id")),
        })

    return {
        "clients": [{"id": c["id"], "name": c["name"]} for c in clients_raw],
        "meta_ads": {
            "total": len(client_ads),
            "brand_ads": len(brand_ads),
            "competitor_ads": len(competitor_ads),
            "breakdown": brand_breakdown,
        },
        "scripts": {
            "total": len(scripts),
            "fresh": len(fresh),
            "copied": len(copied),
            "doubled": len(doubled),
            "from_reels": len(reel_scripts),
        },
        "reels": {
            "total": len(reels),
            "scripts_made": len(reel_ids_with_scripts),
            "unused": len(reels) - len(reel_ids_with_scripts),
        },
        "per_client": per_client,
    }


@app.get("/api/clients/{client_id}")
def get_client_route(client_id: str):
    c = get_client(client_id)
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    return c


@app.get("/api/clients/{client_id}/ads")
def get_client_ads_route(client_id: str):
    return get_client_ads(client_id)


class UpdateBriefRequest(BaseModel):
    brief: str = ""
    google_doc_url: str = ""


class LinkAdRequest(BaseModel):
    ad_id: str
    role: str = "competitor"


@app.post("/api/clients/{client_id}/link-ad")
def link_ad_route(client_id: str, request: LinkAdRequest):
    """Link a specific ad to a client workspace."""
    result = link_ad_to_client(client_id, request.ad_id, request.role)
    return {"status": "linked"}


@app.delete("/api/clients/{client_id}/ads/{ad_id}")
def remove_ad_from_client(client_id: str, ad_id: str):
    """Remove a specific ad from a client workspace (does NOT delete the ad itself).

    Handles both per-ad links (ai_client_ads) and brand-level links (ai_client_brands).
    If the ad was added via brand-level link, we explode the brand link into per-ad links
    for all other ads of that brand, then remove just this one.
    """
    from database import supabase as sb

    # 1. Find which brand this ad belongs to
    ad_row = sb.table("ads").select("brand_id").eq("id", ad_id).execute().data
    if not ad_row:
        return {"status": "not found"}
    brand_id = ad_row[0]["brand_id"]

    # 2. Check if there's a brand-level link for this brand+client
    brand_link = sb.table("ai_client_brands").select("id, role").eq(
        "client_id", client_id
    ).eq("brand_id", brand_id).execute().data

    if brand_link:
        role = brand_link[0]["role"]
        # Get all other ads of this brand
        all_brand_ads = sb.table("ads").select("id").eq("brand_id", brand_id).execute().data
        other_ad_ids = [a["id"] for a in all_brand_ads if a["id"] != ad_id]

        # Remove the brand-level link
        sb.table("ai_client_brands").delete().eq("id", brand_link[0]["id"]).execute()

        # Re-add all other ads as individual per-ad links
        for oid in other_ad_ids:
            try:
                existing = sb.table("ai_client_ads").select("id").eq(
                    "client_id", client_id).eq("ad_id", oid).execute().data
                if not existing:
                    sb.table("ai_client_ads").insert({
                        "client_id": client_id, "ad_id": oid, "role": role
                    }).execute()
            except Exception:
                pass

    # 3. Remove the specific ad from per-ad links (if it was there)
    try:
        sb.table("ai_client_ads").delete().eq("client_id", client_id).eq("ad_id", ad_id).execute()
    except Exception:
        pass

    return {"status": "removed"}


@app.delete("/api/ads/{ad_id}")
def delete_ad(ad_id: str):
    """Permanently delete an ad and all its transcripts/analysis."""
    from database import supabase as sb
    # Cascades handle transcripts, ai_analysis, ai_client_ads
    sb.table("ads").delete().eq("id", ad_id).execute()
    return {"status": "deleted"}


@app.get("/api/clients/{client_id}/brief")
def get_brief(client_id: str):
    result = supabase.table("ai_clients").select("brief, brief_doc_url").eq("id", client_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Client not found")
    row = result.data[0]
    return {"brief": row.get("brief") or "", "brief_doc_url": row.get("brief_doc_url") or ""}


@app.put("/api/clients/{client_id}/brief")
def update_brief(client_id: str, request: UpdateBriefRequest):
    import re, requests as req

    if request.google_doc_url:
        # Extract doc ID from any Google Docs URL format
        m = re.search(r"/document/d/([a-zA-Z0-9_-]+)", request.google_doc_url)
        if not m:
            raise HTTPException(status_code=400, detail="Invalid Google Docs URL")
        doc_id = m.group(1)
        export_url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
        try:
            r = req.get(export_url, timeout=15, allow_redirects=True)
            r.raise_for_status()
            brief_text = r.text.strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not fetch Google Doc: {e}")
        supabase.table("ai_clients").update({
            "brief": brief_text,
            "brief_doc_url": request.google_doc_url,
        }).eq("id", client_id).execute()
        return {"status": "saved", "chars": len(brief_text)}

    supabase.table("ai_clients").update({"brief": request.brief}).eq("id", client_id).execute()
    return {"status": "saved", "chars": len(request.brief)}


@app.post("/api/clients/{client_id}/link-brand")
def link_brand_route(client_id: str, request: LinkBrandRequest):
    """Attach an already-researched brand to a client (instant, no scraping)."""
    result = link_existing_brand(client_id, request.brand_name.strip(), request.role)
    return {"status": "linked"}


@app.get("/api/sessions")
def list_sessions():
    """List recent research sessions."""
    return get_sessions()


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    """Get status of a specific research session."""
    result = supabase.table("research_sessions").select("*").eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data[0]


@app.post("/api/sessions/{session_id}/cancel")
def cancel_session(session_id: str):
    """Mark a session as cancelled (agent will stop processing if it sees this)."""
    supabase.table("research_sessions").update({
        "status": "failed",
        "error_message": "Cancelled by user",
    }).eq("id", session_id).execute()

    # Also cancel any queued/running job for this session
    supabase.table("scrape_jobs").update({
        "status": "error",
        "error_message": "Cancelled by user",
    }).contains("params", {"session_id": session_id}).execute()

    return {"status": "cancelled"}


@app.get("/api/ads")
def list_ads(brand: str = None, limit: int = 50):
    """
    Get all ads with transcripts and AI analysis.
    Optionally filter by brand name.
    """
    return get_all_ads_with_details(brand_name=brand, limit=limit)


@app.get("/api/ads/{ad_id}")
def get_ad(ad_id: str):
    """Get a single ad with all details."""
    result = supabase.table("ads").select(
        "*, brands(name, category), transcripts(*), ai_analysis(*)"
    ).eq("id", ad_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Ad not found")
    return result.data[0]


@app.get("/api/ad-by-meta/{meta_id}")
def get_ad_by_meta(meta_id: str):
    """Get one ad by its Meta Ad Library ID (for single-ad link results)."""
    result = supabase.table("ads").select(
        "*, brands(name, category), transcripts(*), ai_analysis(*)"
    ).eq("meta_library_id", meta_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ad not found")
    return result.data[0]


@app.post("/api/generate-script/adapt")
def generate_adapt_script(body: dict):
    """
    Adapt a competitor ad for a client.
    Body: { ad_id, client_id }
    """
    from script_generator import generate_adapted_script

    ad_id = body.get("ad_id")
    client_id = body.get("client_id")
    if not ad_id or not client_id:
        raise HTTPException(status_code=400, detail="ad_id and client_id required")

    # Fetch ad with transcript + analysis
    ad_row = supabase.table("ads").select(
        "*, brands(name), transcripts(full_text, hook_text), ai_analysis(*)"
    ).eq("id", ad_id).execute().data
    if not ad_row:
        raise HTTPException(status_code=404, detail="Ad not found")
    ad = ad_row[0]

    transcript = (ad.get("transcripts") or {}).get("full_text", "")
    hook = (ad.get("transcripts") or {}).get("hook_text", "")
    analysis = ad.get("ai_analysis") or {}

    # Fetch client brief
    client_row = supabase.table("ai_clients").select("name, brief").eq("id", client_id).execute().data
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")
    client_name = client_row[0].get("name", "")
    client_brief = client_row[0].get("brief", "")

    script = generate_adapted_script(
        competitor_transcript=transcript,
        competitor_hook=hook,
        competitor_analysis=analysis,
        client_name=client_name,
        client_brief=client_brief,
    )

    return {"script": script, "client_name": client_name}


@app.post("/api/scripts")
def save_script(body: dict):
    """Save a generated script. Body: { client_id, type, label, script_text, ad_id? (optional), reel_id? (optional) }"""
    required = ["client_id", "type", "label", "script_text"]
    for f in required:
        if not body.get(f):
            raise HTTPException(status_code=400, detail=f"{f} required")
    row_data = {
        "client_id": body["client_id"],
        "type": body["type"],
        "label": body["label"],
        "script_text": body["script_text"],
    }
    if body.get("ad_id"):
        row_data["ad_id"] = body["ad_id"]
    if body.get("reel_id"):
        row_data["reel_id"] = body["reel_id"]
    row = supabase.table("ai_scripts").insert(row_data).execute()
    return row.data[0]


@app.get("/api/scripts")
def list_scripts(client_id: str = None):
    """List saved scripts, optionally filtered by client."""
    q = supabase.table("ai_scripts").select(
        "*, ai_clients(name), ads(meta_library_id, video_url, brands(name), ai_analysis(hook, tone, hook_type)), inspiration_reels(reel_url, video_url)"
    ).order("created_at", desc=True)
    if client_id:
        q = q.eq("client_id", client_id)
    return q.execute().data


@app.delete("/api/scripts/{script_id}")
def delete_script(script_id: str):
    supabase.table("ai_scripts").delete().eq("id", script_id).execute()
    return {"status": "deleted"}


@app.post("/api/generate-script/multidown")
def generate_multidown(body: dict):
    """
    Multi-ad Double Down — find common pattern across 2+ winning ads and write 2 scripts.
    Body: { ad_ids: [...], client_id }
    """
    from script_generator import generate_multidown_scripts

    ad_ids = body.get("ad_ids", [])
    client_id = body.get("client_id")
    if len(ad_ids) < 2 or not client_id:
        raise HTTPException(status_code=400, detail="Need at least 2 ad_ids and client_id")

    # Fetch client
    client_row = supabase.table("ai_clients").select("name, brief").eq("id", client_id).execute().data
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")
    client_name = client_row[0].get("name", "")
    client_brief = client_row[0].get("brief", "")

    # Fetch each ad
    ads = []
    for ad_id in ad_ids:
        row = supabase.table("ads").select(
            "*, brands(name), transcripts(full_text, hook_text), ai_analysis(*)"
        ).eq("id", ad_id).execute().data
        if not row:
            continue
        ad = row[0]
        ads.append({
            "transcript": (ad.get("transcripts") or {}).get("full_text", ""),
            "hook": (ad.get("transcripts") or {}).get("hook_text", ""),
            "analysis": ad.get("ai_analysis") or {},
            "brand_name": (ad.get("brands") or {}).get("name", ""),
        })

    scripts = generate_multidown_scripts(ads, client_name, client_brief)
    return {"scripts": scripts, "client_name": client_name}


@app.post("/api/generate-script/doubledown")
def generate_doubledown(body: dict):
    """
    Double down on a winning ad — generate 3 variations in same format.
    Body: { ad_id, client_id }
    """
    from script_generator import generate_doubledown_scripts

    ad_id = body.get("ad_id")
    client_id = body.get("client_id")
    if not ad_id or not client_id:
        raise HTTPException(status_code=400, detail="ad_id and client_id required")

    ad_row = supabase.table("ads").select(
        "*, brands(name), transcripts(full_text, hook_text), ai_analysis(*)"
    ).eq("id", ad_id).execute().data
    if not ad_row:
        raise HTTPException(status_code=404, detail="Ad not found")
    ad = ad_row[0]

    transcript = (ad.get("transcripts") or {}).get("full_text", "")
    hook = (ad.get("transcripts") or {}).get("hook_text", "")
    analysis = ad.get("ai_analysis") or {}

    client_row = supabase.table("ai_clients").select("name, brief").eq("id", client_id).execute().data
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")
    client_name = client_row[0].get("name", "")
    client_brief = client_row[0].get("brief", "")

    scripts = generate_doubledown_scripts(
        transcript=transcript,
        hook=hook,
        analysis=analysis,
        brand_name=client_name,
        client_brief=client_brief,
    )
    return {"scripts": scripts, "brand_name": client_name}


class InstaDownloadRequest(BaseModel):
    url: str
    client_id: str


@app.post("/api/instagram/download")
async def instagram_download(request: InstaDownloadRequest):
    """
    Queue an Instagram Reel download job for the local agent.
    The agent downloads the reel on the team member's laptop (home IP + Chrome session)
    and calls /api/instagram/transcribe when the file is ready.
    Frontend polls /api/jobs/{job_id} for completion.
    """
    url = request.url.strip()
    if "instagram.com" not in url:
        raise HTTPException(status_code=400, detail="Not a valid Instagram URL")

    # Check if already exists for this client
    existing = supabase.table("inspiration_reels").select("*").eq(
        "client_id", request.client_id
    ).eq("reel_url", url).execute().data
    if existing:
        return {"status": "exists", "reel": existing[0], "job_id": None}

    # Queue for the agent
    job = supabase.table("scrape_jobs").insert({
        "type": "instagram",
        "status": "queued",
        "params": {"reel_url": url, "client_id": request.client_id}
    }).execute().data[0]

    return {"status": "queued", "job_id": job["id"], "reel": None}


@app.post("/api/instagram/transcribe")
async def instagram_transcribe(
    reel_url: str = Form(...),
    client_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Called by the local agent after downloading an Instagram Reel.
    Receives the video file, transcribes it, saves reel + transcript to Supabase.
    """
    from transcriber import transcribe_video

    # Check if already exists
    existing = supabase.table("inspiration_reels").select("*").eq(
        "client_id", client_id
    ).eq("reel_url", reel_url).execute().data
    if existing:
        return existing[0]

    # Save to temp file and transcribe
    tmp_path = f"/tmp/reel_{client_id[:8]}_{file.filename}"
    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)

        transcript_data = transcribe_video(tmp_path)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    # Save to DB — use original Instagram URL for video_url (browser can embed it)
    row = supabase.table("inspiration_reels").insert({
        "client_id": client_id,
        "reel_url": reel_url,
        "video_url": reel_url,
        "transcript": transcript_data.get("full_text", ""),
        "hook_text": transcript_data.get("hook_text", ""),
    }).execute().data[0]

    return row


@app.get("/api/instagram/reels")
def list_reels(client_id: str):
    """List all inspiration reels for a client."""
    return supabase.table("inspiration_reels").select("*").eq(
        "client_id", client_id
    ).order("created_at", desc=True).execute().data


@app.delete("/api/instagram/reels/{reel_id}")
def delete_reel(reel_id: str):
    supabase.table("inspiration_reels").delete().eq("id", reel_id).execute()
    return {"status": "deleted"}


@app.post("/api/generate-script/inspiration")
def generate_inspiration_script(body: dict):
    """
    Generate a script for a client based on an inspiration reel's format.
    Body: { reel_id, client_id }
    """
    from script_generator import generate_adapted_script

    reel_id = body.get("reel_id")
    client_id = body.get("client_id")
    if not reel_id or not client_id:
        raise HTTPException(status_code=400, detail="reel_id and client_id required")

    reel = supabase.table("inspiration_reels").select("*").eq("id", reel_id).execute().data
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    reel = reel[0]

    client_row = supabase.table("ai_clients").select("name, brief").eq("id", client_id).execute().data
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")
    client_name = client_row[0].get("name", "")
    client_brief = client_row[0].get("brief", "")

    # Use adapted script — reel transcript as the "competitor", client brief as target
    script = generate_adapted_script(
        competitor_transcript=reel.get("transcript", ""),
        competitor_hook=reel.get("hook_text", ""),
        competitor_analysis={
            "tone": "",
            "hook_type": "",
            "why_it_works": "This is an organic Instagram Reel format that resonated with the viewer.",
            "pain_points": [],
            "cta": "",
        },
        client_name=client_name,
        client_brief=client_brief,
    )

    return {"script": script, "client_name": client_name}


@app.post("/api/generate-script/fresh")
def generate_fresh(body: dict):
    """Write 2 fresh scripts from scratch using full client context. Body: { client_id, prompt }"""
    from script_generator import generate_fresh_scripts

    client_id = body.get("client_id")
    prompt_instruction = body.get("prompt", "").strip()
    if not client_id or not prompt_instruction:
        raise HTTPException(status_code=400, detail="client_id and prompt required")

    client_row = supabase.table("ai_clients").select("name, brief").eq("id", client_id).execute().data
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")
    client_name = client_row[0].get("name", "")
    client_brief = client_row[0].get("brief", "") or ""

    all_ads = get_client_ads(client_id)
    proven_ads, competitor_ads = [], []
    for ad in all_ads:
        entry = {
            "transcript": (ad.get("transcripts") or {}).get("full_text", ""),
            "hook": (ad.get("transcripts") or {}).get("hook_text", ""),
            "analysis": ad.get("ai_analysis") or {},
            "brand_name": ad.get("brand_name", ""),
            "days_running": ad.get("days_running", 0),
        }
        if ad.get("role") == "client":
            proven_ads.append(entry)
        else:
            competitor_ads.append(entry)

    proven_ads.sort(key=lambda x: x.get("days_running", 0), reverse=True)
    competitor_ads.sort(key=lambda x: x.get("days_running", 0), reverse=True)

    scripts = generate_fresh_scripts(
        client_name=client_name,
        client_brief=client_brief,
        prompt_instruction=prompt_instruction,
        proven_ads=proven_ads,
        competitor_ads=competitor_ads,
    )
    return {"scripts": scripts, "client_name": client_name}


@app.get("/api/brands")
def list_brands():
    """List all brands that have been analyzed."""
    return supabase.table("brands").select("*").order("name").execute().data


@app.get("/api/library")
def search_library(
    tone: str = None,
    hook_type: str = None,
    min_days: int = None,
    brand: str = None,
    min_score: int = None,
    limit: int = 50
):
    """
    Search the full ad library with filters.
    This is the View 3 — Library search.
    """
    # Build query joining ads + ai_analysis
    query = supabase.table("ads").select(
        "*, brands(name, category), transcripts(full_text, hook_text), ai_analysis(*)"
    ).order("last_scraped_at", desc=True).limit(limit)

    if min_days:
        query = query.gte("days_running", min_days)

    result = query.execute()
    ads = result.data

    # Filter by AI analysis fields (post-query filtering)
    if tone or hook_type or min_score or brand:
        filtered = []
        for ad in ads:
            ai = ad.get("ai_analysis") or {}
            b = ad.get("brands") or {}

            if brand and brand.lower() not in b.get("name", "").lower():
                continue
            if tone and ai.get("tone", "").lower() != tone.lower():
                continue
            if hook_type and ai.get("hook_type", "").lower() != hook_type.lower():
                continue
            if min_score and (ai.get("script_quality_score") or 0) < min_score:
                continue
            filtered.append(ad)
        return filtered

    return ads


@app.get("/api/export/csv")
def export_csv(brand: str = None):
    """Export all ads as CSV data."""
    import csv
    import io

    ads = get_all_ads_with_details(brand_name=brand, limit=500)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Brand", "Days Running", "Performance Tier",
        "Hook", "Core Offer", "CTA", "Tone", "Hook Type",
        "Script Score", "Target Audience", "Why It Works",
        "Full Transcript", "Ad Copy", "Video URL", "Platforms"
    ])

    for ad in ads:
        ai = ad.get("ai_analysis") or {}
        tr = ad.get("transcripts") or {}
        brand_info = ad.get("brands") or {}

        writer.writerow([
            brand_info.get("name", ""),
            ad.get("days_running", 0),
            ad.get("performance_tier", ""),
            ai.get("hook", ""),
            ai.get("core_offer", ""),
            ai.get("cta", ""),
            ai.get("tone", ""),
            ai.get("hook_type", ""),
            ai.get("script_quality_score", ""),
            ai.get("target_audience", ""),
            ai.get("why_it_works", ""),
            tr.get("full_text", ""),
            ad.get("ad_copy", ""),
            ad.get("video_url", ""),
            ", ".join(ad.get("platforms", []))
        ])

    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=ad-intelligence-export.csv"}
    )


@app.get("/api/download")
def download_video(path: str):
    """
    Proxy download for Meta CDN video URLs.
    Fetches the video and returns it as an attachment so the browser downloads it
    instead of opening it in a new tab.
    """
    import requests as req
    from fastapi.responses import StreamingResponse
    import urllib.parse

    if not path.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")

    try:
        r = req.get(path, stream=True, timeout=60, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        r.raise_for_status()

        filename = urllib.parse.urlparse(path).path.split("/")[-1] or "video.mp4"
        if "?" in filename:
            filename = filename.split("?")[0]
        if not filename.endswith(".mp4"):
            filename = "ad-video.mp4"

        return StreamingResponse(
            r.iter_content(chunk_size=8192),
            media_type="video/mp4",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")
