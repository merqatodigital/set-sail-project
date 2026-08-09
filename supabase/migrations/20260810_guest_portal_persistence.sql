-- ===========================================================================
-- GUEST PORTAL PERSISTENCE — minimal schema gaps
-- ===========================================================================
-- Purpose: give the Guest Portal (BookExperiences / RentMotorbike / OrderFood
-- / MessageReception / My Stay / View Bill) a persistent, server-side source
-- of truth so Portal, Admin, and the TALA agent all read/write the SAME
-- records. localStorage / cms_data blobs remain UI cache / demo fallback only.
--
-- Design rules honored:
--   * Reuse the existing tala_*_requests tables (no duplicate request tables).
--   * SECURITY: anon may INSERT (submit) guest intents but must NEVER be able
--     to SELECT another guest's data. All private guest reads go through the
--     server-side Guest Portal API (src/lib/portalApi.server.ts + src/server.ts)
--     which uses the service role key and filters strictly by the signed guest
--     session's phone number. This migration removes any anon SELECT policy /
--     grant on private guest tables.
--   * Every guest-created transaction persists server-side with a lifecycle
--     (requested -> confirmed -> ... -> settled) driven by the OWNER, never
--     auto-confirmed by the guest.
--   * Only genuinely missing sources are created: guest->staff messages,
--     guest food orders, and minimal folio lines for charges that have no
--     other persistent table.
--   * No fake duplicate charge/payment data anywhere.
--
-- Run in Supabase SQL Editor. Idempotent — safe to run more than once.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend tala_*_requests with the fields the portal + existing confirm
--    flows need. NOTE: the tala-chat edge function and src/components/tala/
--    talaTools.ts already UPDATE `confirmed_at` on these tables, but the
--    column was never created — this fixes that latent bug too.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tala_booking_requests
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.tala_tour_requests
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.tala_rental_requests
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Guest food orders (guest-facing). The Worker /api/orders -> D1
--    food_orders path exists but is requireAuth() + tenant-gated, so an
--    anonymous portal guest cannot use it without a Hermes contract change.
--    This Supabase table is the guest-facing authoritative food source;
--    the D1 store remains the staff/auth path. Items stored as JSONB (one
--    row per order) — simplest guest-writable shape.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',       -- [{ menuItemId, name, quantity, price, foodCost }]
  total NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|preparing|ready|delivered|cancelled
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'portal',   -- portal|tala_chat|worker
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 3. Guest <-> staff message inbox (persistent). Survives refresh/login and
--    is visible to the TALA / admin inbox.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_guest_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  reply TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unread',   -- unread|read|replied
  source TEXT NOT NULL DEFAULT 'portal',   -- portal|tala_chat
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 4. Minimal folio lines — ONLY for legitimate charges/payments that have no
--    other persistent transaction source (e.g. owner-added misc charges like
--    late checkout, laundry, transfers, or cash received against a request).
--    Guest charges themselves live in tala_*_requests / tala_food_orders.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_folio_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'charge',     -- charge|payment
  category TEXT NOT NULL DEFAULT 'other',  -- room|tour|rental|food|service|other
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',     -- cash|gcash|bank_transfer|card|other
  reference TEXT NOT NULL DEFAULT '',
  related_type TEXT NOT NULL DEFAULT '',   -- booking|tour|rental|food|other
  related_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Grants + RLS for the new portal tables.
-- SECURITY: anon can INSERT (guest submissions) only. NO anon SELECT — private
-- guest data (food orders, messages, folio) is only readable through the
-- server-side Guest Portal API (service role key, scoped by signed session).
-- Authenticated (owner / admin face) can manage rows: confirm, reply, settle.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tala_food_orders',
    'tala_guest_messages',
    'tala_folio_lines'
  ] LOOP
    -- Revoke any anon SELECT that an earlier (unlocked) version of this file
    -- may have granted, and re-grant INSERT-only for anon.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT INSERT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop every prior read/write policy name this file may have created.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Anyone can submit ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Anyone can read ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated can manage ' || t, t);

    -- anon: INSERT only. NO SELECT policy -> RLS denies every anon read.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)',
      'Anyone can submit ' || t, t
    );

    -- authenticated (owner/admin): full management.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Authenticated can manage ' || t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Harden the existing tala_*_requests tables: anon INSERT-only.
--    The original 20260729090000 migration left permissive "Anyone can read"
--    policies (anon SELECT USING true) and 20260804_security_fix_rls.sql
--    dropped policy names that never existed ("Allow public read on ..."),
--    so those permissive anon SELECT policies may still be live in the DB.
--    Remove every anon SELECT path so private reads are server-scoped only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
DECLARE label TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tala_booking_requests', 'tala_tour_requests', 'tala_rental_requests'] LOOP
    label := CASE t
      WHEN 'tala_booking_requests' THEN 'booking'
      WHEN 'tala_tour_requests'    THEN 'tour'
      WHEN 'tala_rental_requests'  THEN 'rental'
      ELSE t END;

    -- Revoke any anon SELECT grant; keep anon INSERT.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT INSERT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop every permissive / duplicate policy, using BOTH the original
    -- 20260729090000 names and the (never-created) names the security-fix
    -- migration tried to drop — belt and suspenders, all idempotent.
    EXECUTE format('DROP POLICY IF EXISTS "Anyone can read %s requests" ON public.%I', label, t);
    EXECUTE format('DROP POLICY IF EXISTS "Anyone can submit a %s request" ON public.%I', label, t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read on %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anonymous insert on %I" ON public.%I', t, t);

    -- anon: INSERT only.
    EXECUTE format(
      'CREATE POLICY "Anonymous can insert %s requests" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)',
      label, t
    );

    -- authenticated (owner/admin): read + update.
    EXECUTE format(
      'CREATE POLICY "Authenticated can read %s requests" ON public.%I FOR SELECT TO authenticated USING (true)',
      label, t
    );
    EXECUTE format(
      'CREATE POLICY "Authenticated can update %s requests" ON public.%I FOR UPDATE TO authenticated USING (true)',
      label, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- select has_table_privilege('anon', 'public.tala_food_orders',    'INSERT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_food_orders',    'SELECT'); -- expect: false
-- select has_table_privilege('anon', 'public.tala_guest_messages', 'INSERT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_guest_messages', 'SELECT'); -- expect: false
-- select has_table_privilege('anon', 'public.tala_folio_lines',    'INSERT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_folio_lines',    'SELECT'); -- expect: false
-- select has_table_privilege('anon', 'public.tala_tour_requests',  'INSERT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_tour_requests',  'SELECT'); -- expect: false
-- select has_table_privilege('anon', 'public.tala_booking_requests','SELECT'); -- expect: false
-- select polname, polroles::regrole[] from pg_policy
--   where polrelid = 'public.tala_guest_messages'::regclass;
--   -- expect: only the INSERT policy + authenticated manage (no anon SELECT)
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='tala_tour_requests'
--   order by ordinal_position;  -- expect reference, confirmed_at, paid_amount, paid_at present
