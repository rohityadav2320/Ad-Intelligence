-- Run this entire file in your Supabase SQL Editor (one time setup)
-- Go to: Supabase Dashboard → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    meta_page_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    competitor_brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    identified_by TEXT DEFAULT 'ai'
);

CREATE TABLE IF NOT EXISTS ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    meta_library_id TEXT UNIQUE,
    started_running_on DATE,
    days_running INTEGER DEFAULT 0,
    performance_tier TEXT CHECK (performance_tier IN ('PROVEN', 'TESTING', 'NEW')),
    platforms JSONB DEFAULT '[]',
    video_url TEXT,
    thumbnail_url TEXT,
    ad_copy TEXT,
    status TEXT DEFAULT 'active',
    last_scraped_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transcripts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE UNIQUE,
    full_text TEXT,
    hook_text TEXT,
    word_timestamps JSONB DEFAULT '[]',
    language TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

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

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_ads_brand_id ON ads(brand_id);
CREATE INDEX IF NOT EXISTS idx_ads_days_running ON ads(days_running DESC);
CREATE INDEX IF NOT EXISTS idx_ads_performance_tier ON ads(performance_tier);
CREATE INDEX IF NOT EXISTS idx_transcripts_ad_id ON transcripts(ad_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_ad_id ON ai_analysis(ad_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_tone ON ai_analysis(tone);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON research_sessions(created_at DESC);
