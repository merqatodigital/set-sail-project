-- ===========================================================================
-- GUEST PORTAL PERSISTENCE — minimal schema gaps
-- ===========================================================================
-- Purpose: give the Guest Portal (BookExperiences / RentMotorbike / OrderFood
-- / MessageReception / My Stay / View Bill) a persistent, server-side source
-- of truth so Portal, Admin, and the TALA agent all read/write the SAME
-- records. localStorage / cms_data blobs remain UI cache / demo fallback only.
--
-- Design rules honored:
--   * Reuse the existing tala_*_requests tables (already RLS-correct: anon
--     INSERT+SELECT, owner UPDATE) — no duplicate request tables.
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
-- Grants + RLS — mirror the tala_*_requests pattern exactly: anyone (anon /
-- authenticated) may INSERT + SELECT (portal guests are anonymous; they read
-- their own rows and the app filters by phone/name). Authenticated (owner /
-- admin face) may UPDATE/DELETE to confirm, reply, and settle.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tala_food_orders',
    'tala_guest_messages',
    'tala_folio_lines'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Anyone can submit ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)',
      'Anyone can submit ' || t, t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Anyone can read ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'Anyone can read ' || t, t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Authenticated can manage ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Authenticated can manage ' || t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- select has_table_privilege('anon', 'public.tala_food_orders',   'INSERT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_food_orders',   'SELECT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_food_orders',   'UPDATE'); -- expect: false
-- select has_table_privilege('anon', 'public.tala_guest_messages','INSERT'); -- expect: true
-- select has_table_privilege('anon', 'public.tala_folio_lines',   'SELECT'); -- expect: true
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='tala_tour_requests'
--   order by ordinal_position;  -- expect reference, confirmed_at, paid_amount, paid_at present
