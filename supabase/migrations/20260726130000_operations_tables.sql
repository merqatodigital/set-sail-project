-- ===========================================================================
-- Operations tables — replaces the `operations` key inside cms_data
-- ===========================================================================
-- Problem being fixed: bookings, staff, payroll, and revenue/expense records
-- lived inside the same single-row `cms_data` JSON blob as public site
-- content. The previous migration locked that row's WRITE access to admins,
-- but it is still `SELECT`-able by anon (the public site needs to read the
-- rest of the row to render). That means anyone holding the public anon key
-- can still read every guest's booking, every staff payroll amount, and
-- total revenue/expenses.
--
-- Fix: move these ten entities into their own tables, admin-only for both
-- read and write via has_role(auth.uid(), 'admin') (defined in the
-- admin_auth_and_rls_lockdown migration — this migration must run after it).
-- cms_data keeps site content only; the `operations` key in it becomes
-- unused dead weight (left in place, simply no longer read/written by the
-- app — see the accompanying code changes).
--
-- IDs are TEXT to match the existing `uid()`-generated string ids already
-- referenced by relatedId/guestId/staffId/etc. fields throughout the app,
-- so no data model changes are needed on the TypeScript side beyond
-- swapping cms.operations.* reads for a table query.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL DEFAULT '',
  guest_id TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  room_type TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  guests INT NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'direct',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tour_bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL DEFAULT '',
  tour_id TEXT NOT NULL DEFAULT '',
  tour_name TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  guests INT NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  pay_type TEXT NOT NULL DEFAULT 'monthly',
  pay_rate NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  hired_at TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.pay_records (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL DEFAULT '',
  period_start TEXT NOT NULL DEFAULT '',
  period_end TEXT NOT NULL DEFAULT '',
  hours NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  direction TEXT NOT NULL DEFAULT 'in',
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  related_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.motorbikes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  plate TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.motorbike_rentals (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL DEFAULT '',
  bike_id TEXT NOT NULL DEFAULT '',
  bike_name TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  days INT NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  deposit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tours (the catalog, not bookings of them) was already admin-edited content
-- living in cms_data.operations.tours — moved here too for consistency since
-- ToursManager edits both the catalog and bookings on the same page.
CREATE TABLE IF NOT EXISTS public.tours_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  capacity INT NOT NULL DEFAULT 1,
  inclusions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Grants + RLS — admin-only, full stop. No anon/guest use case for any of
-- these tables (guest-facing booking capture stays on tala_leads /
-- booking_leads-style tables, not here).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'guests','bookings','tour_bookings','staff_members','shifts',
    'pay_records','payments','motorbikes','motorbike_rentals','tours_catalog'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Admins can manage ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      'Admins can manage ' || t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Guest-facing exceptions — bookings only, mirroring the tala_leads pattern:
-- ---------------------------------------------------------------------------
-- 1. TALA's check_room_availability tool needs to know which date ranges are
--    already taken WITHOUT exposing guest names, contact info, or amounts —
--    none of which is anon-readable now that bookings is admin-only. A
--    SECURITY DEFINER function returns only room_type + dates for
--    active bookings overlapping a given range.
CREATE OR REPLACE FUNCTION public.room_availability_conflicts(p_check_in TEXT, p_check_out TEXT)
RETURNS TABLE(room_type TEXT, check_in TEXT, check_out TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.room_type, b.check_in, b.check_out
  FROM public.bookings b
  WHERE b.status IN ('pending', 'confirmed', 'checked_in')
    AND b.check_in::date < p_check_out::date
    AND b.check_out::date > p_check_in::date;
$$;

GRANT EXECUTE ON FUNCTION public.room_availability_conflicts(TEXT, TEXT) TO anon, authenticated;

-- 2. TALA lets a guest confirm their own booking draft as a PENDING request
--    (the team confirms it later — see request_booking / confirmBookingDraft
--    in talaTools.ts). Anon may only INSERT, and only ever with
--    status = 'pending', mirroring "Anyone can submit a lead": a guest can
--    propose a booking, never alter, approve, or read one.
GRANT INSERT ON public.bookings TO anon;
DROP POLICY IF EXISTS "Guests can submit a pending booking" ON public.bookings;
CREATE POLICY "Guests can submit a pending booking"
  ON public.bookings FOR INSERT TO anon
  WITH CHECK (status = 'pending');

-- 3. Tour catalog (name/description/price/duration) was public marketing
--    content when it lived inside cms_data — guests need to browse it to
--    pick a tour while booking with TALA (see TalaWidget's tour picker).
--    This is the one entity of the ten that isn't operational/financial, so
--    it gets a narrow anon-SELECT exception, restricted to active tours.
GRANT SELECT ON public.tours_catalog TO anon;
DROP POLICY IF EXISTS "Anyone can view active tours" ON public.tours_catalog;
CREATE POLICY "Anyone can view active tours"
  ON public.tours_catalog FOR SELECT TO anon
  USING (active = true);

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- select has_table_privilege('anon', 'public.bookings', 'SELECT');       -- expect: false
-- select has_table_privilege('anon', 'public.bookings', 'INSERT');       -- expect: true
-- select has_table_privilege('anon', 'public.pay_records', 'SELECT');    -- expect: false
-- select has_table_privilege('anon', 'public.payments', 'SELECT');       -- expect: false
-- select has_table_privilege('anon', 'public.tours_catalog', 'SELECT'); -- expect: true
