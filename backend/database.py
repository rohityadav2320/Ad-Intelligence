import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_KEY", "")
)

# ─── Schema creation SQL (run once in Supabase SQL editor) ───────────────────
SCHEMA_SQL = """
-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    meta_page_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Competitors table
CREATE TABLE IF NOT EXISTS competitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    competitor_brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    identified_by TEXT DEFAULT 'ai'
);

-- Ads table
CREATE TABLE IF NOT EXISTS ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    meta_library_id TEXT UNIQUE,
    started_running_on DATE,
    days_running INTEGER,
    performance_tier TEXT CHECK (performance_tier IN ('PROVEN', 'TESTING', 'NEW')),
    platforms JSONB DEFAULT '[]',
    video_url TEXT,
    thumbnail_url TEXT,
    ad_copy TEXT,
    status TEXT DEFAULT 'active',
    last_scraped_at TIMESTAMPTZ DEFAULT now()
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE UNIQUE,
    full_text TEXT,
    hook_text TEXT,
    word_timestamps JSONB DEFAULT '[]',
    language TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Analysis table
CREATE TABLE IF NOT EXISTS ai_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE UNIQUE,
    hook TEXT,
    core_offer TEXT,
    cta TEXT,
    tone TEXT,
    pain_points JSONB DEFAULT '[]',
    target_audience TEXT,
    why_it_works TEXT,
    script_quality_score INTEGER,
    hook_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Research sessions table
CREATE TABLE IF NOT EXISTS research_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    input_brand TEXT NOT NULL,
    brands_analyzed JSONB DEFAULT '[]',
    total_ads_found INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
"""


def get_or_create_brand(name: str, category: str = None) -> dict:
    existing = supabase.table("brands").select("*").ilike("name", name).execute()
    if existing.data:
        return existing.data[0]
    result = supabase.table("brands").insert({
        "name": name,
        "category": category
    }).execute()
    return result.data[0]


def save_ad(brand_id: str, ad_data: dict) -> dict:
    existing = supabase.table("ads").select("id").eq(
        "meta_library_id", ad_data["meta_library_id"]
    ).execute()

    if existing.data:
        # Update days_running and last_scraped_at
        supabase.table("ads").update({
            "days_running": ad_data["days_running"],
            "performance_tier": ad_data["performance_tier"],
            "last_scraped_at": "now()"
        }).eq("meta_library_id", ad_data["meta_library_id"]).execute()
        return existing.data[0]

    result = supabase.table("ads").insert({
        "brand_id": brand_id,
        **ad_data
    }).execute()
    return result.data[0]


def save_transcript(ad_id: str, transcript_data: dict) -> dict:
    existing = supabase.table("transcripts").select("id").eq("ad_id", ad_id).execute()
    if existing.data:
        return existing.data[0]
    result = supabase.table("transcripts").insert({
        "ad_id": ad_id,
        **transcript_data
    }).execute()
    return result.data[0]


def save_analysis(ad_id: str, analysis_data: dict) -> dict:
    existing = supabase.table("ai_analysis").select("id").eq("ad_id", ad_id).execute()
    if existing.data:
        return existing.data[0]
    result = supabase.table("ai_analysis").insert({
        "ad_id": ad_id,
        **analysis_data
    }).execute()
    return result.data[0]


def delete_transcript_and_analysis(ad_id: str):
    """Remove existing transcript + analysis so they can be regenerated."""
    supabase.table("transcripts").delete().eq("ad_id", ad_id).execute()
    supabase.table("ai_analysis").delete().eq("ad_id", ad_id).execute()


def create_session(brand_name: str, client_id: str = None) -> dict:
    payload = {"input_brand": brand_name, "status": "running"}
    if client_id:
        payload["ai_client_id"] = client_id
    result = supabase.table("research_sessions").insert(payload).execute()
    return result.data[0]


# ─── Client workspace functions ──────────────────────────────────────────────

def create_client(name: str) -> dict:
    existing = supabase.table("ai_clients").select("*").ilike("name", name).execute()
    if existing.data:
        return existing.data[0]
    return supabase.table("ai_clients").insert({"name": name}).execute().data[0]


def list_clients() -> list:
    clients = supabase.table("ai_clients").select("*").order("created_at", desc=True).execute().data
    # Attach brand counts + roles
    for c in clients:
        links = supabase.table("ai_client_brands").select(
            "role, brands(name)"
        ).eq("client_id", c["id"]).execute().data
        c["brands"] = [
            {"name": (l.get("brands") or {}).get("name"), "role": l["role"]}
            for l in links if l.get("brands")
        ]
    return clients


def get_client(client_id: str) -> dict:
    c = supabase.table("ai_clients").select("*").eq("id", client_id).execute().data
    if not c:
        return None
    client = c[0]
    links = supabase.table("ai_client_brands").select(
        "role, brands(id, name, category)"
    ).eq("client_id", client_id).execute().data
    client["brands"] = [
        {"id": (l["brands"] or {}).get("id"), "name": (l["brands"] or {}).get("name"),
         "role": l["role"]}
        for l in links if l.get("brands")
    ]
    return client


def link_brand_to_client(client_id: str, brand_id: str, role: str = "competitor"):
    existing = supabase.table("ai_client_brands").select("id").eq(
        "client_id", client_id
    ).eq("brand_id", brand_id).execute()
    if existing.data:
        supabase.table("ai_client_brands").update({"role": role}).eq(
            "id", existing.data[0]["id"]
        ).execute()
        return existing.data[0]
    return supabase.table("ai_client_brands").insert({
        "client_id": client_id, "brand_id": brand_id, "role": role
    }).execute().data[0]


def get_clients_dashboard() -> list:
    """Clients enriched with aggregate metrics for the home dashboard cards."""
    clients = supabase.table("ai_clients").select("*").order("created_at", desc=True).execute().data
    for c in clients:
        links = supabase.table("ai_client_brands").select(
            "role, brand_id, brands(name, category)"
        ).eq("client_id", c["id"]).execute().data

        c["brands"] = []
        ad_count = 0
        proven = 0
        top_days = 0
        category = None
        for l in links:
            b = l.get("brands") or {}
            c["brands"].append({"name": b.get("name"), "role": l["role"]})
            if l["role"] == "client" and b.get("category"):
                category = b["category"]
            ads = supabase.table("ads").select("days_running, performance_tier").eq(
                "brand_id", l["brand_id"]
            ).execute().data
            ad_count += len(ads)
            proven += sum(1 for a in ads if a.get("performance_tier") == "PROVEN")
            for a in ads:
                if (a.get("days_running") or 0) > top_days:
                    top_days = a["days_running"]

        c["category"] = category
        c["ad_count"] = ad_count
        c["proven_count"] = proven
        c["top_days"] = top_days
    return clients


def get_dashboard_stats() -> dict:
    clients = supabase.table("ai_clients").select("id", count="exact").execute()
    brands = supabase.table("brands").select("id", count="exact").execute()
    ads = supabase.table("ads").select("performance_tier", count="exact").execute()
    proven = sum(1 for a in (ads.data or []) if a.get("performance_tier") == "PROVEN")
    return {
        "clients": clients.count or 0,
        "brands": brands.count or 0,
        "ads": ads.count or 0,
        "proven": proven,
    }


def get_top_ads(limit: int = 12) -> list:
    """Cross-client leaderboard: best-performing ads across everything."""
    ads = supabase.table("ads").select(
        "*, brands(name), ai_analysis(hook, tone, script_quality_score, cta)"
    ).order("days_running", desc=True).limit(200).execute().data

    def score(a):
        ai = a.get("ai_analysis") or {}
        return ((ai.get("script_quality_score") or 0), a.get("days_running") or 0)

    ranked = sorted(ads, key=score, reverse=True)
    return ranked[:limit]


def link_existing_brand(client_id: str, brand_name: str, role: str = "competitor"):
    """Attach a brand to a client, creating the brand row if it doesn't exist yet."""
    b = supabase.table("brands").select("id").ilike("name", brand_name).execute()
    if not b.data:
        # Create a placeholder brand row so the client workspace works immediately
        inserted = supabase.table("brands").insert({"name": brand_name}).execute()
        brand_id = inserted.data[0]["id"]
    else:
        brand_id = b.data[0]["id"]
    return link_brand_to_client(client_id, brand_id, role)


def list_all_brands() -> list:
    return supabase.table("brands").select("id, name, category").order("name").execute().data


def link_ad_to_client(client_id: str, ad_id: str, role: str = "competitor"):
    """Link a specific ad to a client workspace.
    Also removes any brand-level link for the same brand so brand-bulk doesn't override."""
    try:
        # Find this ad's brand
        ad_row = supabase.table("ads").select("brand_id").eq("id", ad_id).execute().data
        if ad_row:
            brand_id = ad_row[0]["brand_id"]
            # Remove brand-level link for this brand (switching to per-ad mode)
            supabase.table("ai_client_brands").delete().eq(
                "client_id", client_id
            ).eq("brand_id", brand_id).execute()

        # Upsert the per-ad link
        existing = supabase.table("ai_client_ads").select("id").eq(
            "client_id", client_id
        ).eq("ad_id", ad_id).execute()
        if existing.data:
            supabase.table("ai_client_ads").update({"role": role}).eq(
                "id", existing.data[0]["id"]
            ).execute()
            return existing.data[0]
        return supabase.table("ai_client_ads").insert({
            "client_id": client_id, "ad_id": ad_id, "role": role
        }).execute().data[0]
    except Exception as e:
        print(f"[DB] link_ad_to_client error: {e}")
        return None


def get_client_ads(client_id: str) -> list:
    """All ads for a client — from per-ad links (ai_client_ads) + brand-level links (ai_client_brands)."""
    result = []
    seen_ad_ids = set()

    # 1. Per-ad links (preferred — user selected specific ads)
    try:
        ad_links = supabase.table("ai_client_ads").select("role, ad_id, created_at").eq("client_id", client_id).order("created_at", desc=True).execute().data
        for link in ad_links:
            ad_id = link["ad_id"]
            role = link["role"]
            rows = supabase.table("ads").select(
                "*, brands(name), transcripts(full_text, hook_text), ai_analysis(*)"
            ).eq("id", ad_id).execute().data
            if not rows:
                continue
            ad = rows[0]
            ad["brand_name"] = (ad.get("brands") or {}).get("name", "")
            ad["role"] = role
            result.append(ad)
            seen_ad_ids.add(ad["id"])
    except Exception as e:
        print(f"[DB] get_client_ads per-ad query error: {e}")

    # 2. Brand-level links — only for brands that have NO per-ad links yet
    try:
        # Collect brand_ids already covered by per-ad links
        covered_brand_ids = set()
        if seen_ad_ids:
            for aid in seen_ad_ids:
                row = supabase.table("ads").select("brand_id").eq("id", aid).execute().data
                if row:
                    covered_brand_ids.add(row[0]["brand_id"])

        brand_links = supabase.table("ai_client_brands").select(
            "role, brand_id, brands(name)"
        ).eq("client_id", client_id).execute().data
        for link in brand_links:
            brand_id = link["brand_id"]
            if brand_id in covered_brand_ids:
                # This brand is already managed per-ad — skip brand-level bulk
                continue
            role = link["role"]
            brand_name = (link.get("brands") or {}).get("name", "")
            ads = supabase.table("ads").select(
                "*, transcripts(full_text, hook_text), ai_analysis(*)"
            ).eq("brand_id", brand_id).order("last_scraped_at", desc=True).execute().data
            for ad in ads:
                if ad["id"] not in seen_ad_ids:
                    ad["brand_name"] = brand_name
                    ad["role"] = role
                    result.append(ad)
                    seen_ad_ids.add(ad["id"])
    except Exception as e:
        print(f"[DB] get_client_ads brand-level query error: {e}")

    return result


def update_session(session_id: str, updates: dict):
    supabase.table("research_sessions").update(updates).eq("id", session_id).execute()


def get_all_ads_with_details(brand_name: str = None, limit: int = 50) -> list:
    query = supabase.table("ads").select(
        "*, brands(name, category), transcripts(full_text, hook_text), ai_analysis(*)"
    ).order("last_scraped_at", desc=True).limit(limit)

    if brand_name:
        brand = supabase.table("brands").select("id").ilike("name", brand_name).execute()
        if not brand.data:
            # No brand by that name — return nothing rather than every ad in the DB.
            return []
        query = query.eq("brand_id", brand.data[0]["id"])

    return query.execute().data


def get_sessions() -> list:
    return supabase.table("research_sessions").select("*").order(
        "created_at", desc=True
    ).limit(20).execute().data
