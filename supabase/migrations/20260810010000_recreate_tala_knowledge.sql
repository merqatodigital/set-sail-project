-- ===========================================================================
-- RE-CREATE tala_knowledge (was dropped by 20260804_cleanup_tables.sql)
-- The Admin "TALA Knowledge Base" page + TALA's knowledgeForPrompt() still
-- query this table, so it must exist. Run in Lovable / Supabase SQL Editor.
-- Idempotent: safe to run even if partially present.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.tala_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',          -- comma-separated free tags
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.tala_knowledge TO anon;
GRANT SELECT, INSERT ON public.tala_knowledge TO authenticated;
GRANT ALL ON public.tala_knowledge TO service_role;

ALTER TABLE public.tala_knowledge ENABLE ROW LEVEL SECURITY;

-- Admin panel uses a local passkey, not Supabase Auth: anon can only append
-- and read (mirrors tala_goals / tala_tasks policy).
-- NOTE: Postgres has no CREATE POLICY IF NOT EXISTS — recreate idempotently.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can add knowledge" ON public.tala_knowledge;
  CREATE POLICY "Anyone can add knowledge"
    ON public.tala_knowledge FOR INSERT TO anon, authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Anyone can read knowledge" ON public.tala_knowledge;
  CREATE POLICY "Anyone can read knowledge"
    ON public.tala_knowledge FOR SELECT TO anon, authenticated USING (true);
END $$;
