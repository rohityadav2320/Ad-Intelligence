-- Run this in Supabase SQL Editor BEFORE deploying
-- Adds the scrape_jobs table used by the local agent job queue

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('meta', 'instagram')),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'done', 'error')),
    params JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast polling (agent polls for 'queued' jobs ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status_created
    ON scrape_jobs (status, created_at);
