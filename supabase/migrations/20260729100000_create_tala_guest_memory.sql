-- tala_guest_memory: small per-guest key-value memory store.
-- The guest orb (and owner face) can write/read small facts so TALA recalls
-- preferences across sessions. Non-sensitive only — no PII enforcement here,
-- just guest-chosen keys (phone/email/name) and short facts.

CREATE TABLE IF NOT EXISTS public.tala_guest_memory (
  guest_key TEXT NOT NULL DEFAULT '',
  fact TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guest_key)
);

GRANT SELECT, INSERT ON public.tala_guest_memory TO anon;
GRANT SELECT, INSERT ON public.tala_guest_memory TO authenticated;
GRANT ALL ON public.tala_guest_memory TO service_role;

ALTER TABLE public.tala_guest_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upsert memory"
  ON public.tala_guest_memory FOR INSERT TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can read memory"
  ON public.tala_guest_memory FOR SELECT TO anon, authenticated
  USING (true);
