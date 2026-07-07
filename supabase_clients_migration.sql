-- Run this in Supabase SQL Editor (one time) to add client workspaces.
-- Go to: Supabase Dashboard → SQL Editor → New query → paste → Run without RLS
-- NOTE: prefixed "ai_" to avoid colliding with the Vidrow Portal's existing "clients" table.

-- An ad-intelligence client = an agency client account (e.g. "Oolka")
CREATE TABLE IF NOT EXISTS ai_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Links brands to a client, each tagged as the client's own brand or a competitor
CREATE TABLE IF NOT EXISTS ai_client_brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES ai_clients(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'competitor' CHECK (role IN ('client', 'competitor')),
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (client_id, brand_id)
);

-- Tag research sessions with the client they belong to
ALTER TABLE research_sessions ADD COLUMN IF NOT EXISTS ai_client_id UUID REFERENCES ai_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_client_brands_client ON ai_client_brands(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_client_brands_brand ON ai_client_brands(brand_id);
