-- ===========================================================================
-- TALA guest-facing action tables
-- These make the PUBLIC TALA orb feel like an agent instead of a Q&A bot,
-- without ever letting an anonymous visitor write to the monolithic cms_data
-- blob (the same security rule as tala_leads): the guest orb can READ live
-- data (rooms, availability, tours, motorbikes) and WRITE *intents* — a
-- booking/tour/rental request the owner confirms inside the admin console.
-- anon can only INSERT (append) and SELECT; it can never UPDATE/DELETE, so a
-- visitor can never alter an operator's records or confirm their own booking.
-- ===========================================================================

-- --- Booking requests (guest orb) -----------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL DEFAULT '',
  room_type TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',     -- ISO YYYY-MM-DD
  check_out TEXT NOT NULL DEFAULT '',
  guests INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,     -- PHP, if quoted
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',-- 'pending' -> owner confirms in admin
  source TEXT NOT NULL DEFAULT 'tala_chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Tour booking requests (guest orb) ------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_tour_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  tour_name TEXT NOT NULL DEFAULT '',
  tour_date TEXT NOT NULL DEFAULT '',    -- ISO YYYY-MM-DD
  guests INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested',
  source TEXT NOT NULL DEFAULT 'tala_chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Motorbike rental requests (guest orb) --------------------------------
CREATE TABLE IF NOT EXISTS public.tala_rental_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  bike_name TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested',
  source TEXT NOT NULL DEFAULT 'tala_chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Grants ---------------------------------------------------------------
GRANT SELECT, INSERT ON public.tala_booking_requests TO anon;
GRANT SELECT, INSERT ON public.tala_booking_requests TO authenticated;
GRANT ALL ON public.tala_booking_requests TO service_role;

GRANT SELECT, INSERT ON public.tala_tour_requests TO anon;
GRANT SELECT, INSERT ON public.tala_tour_requests TO authenticated;
GRANT ALL ON public.tala_tour_requests TO service_role;

GRANT SELECT, INSERT ON public.tala_rental_requests TO anon;
GRANT SELECT, INSERT ON public.tala_rental_requests TO authenticated;
GRANT ALL ON public.tala_rental_requests TO service_role;

-- --- Row Level Security ----------------------------------------------------
ALTER TABLE public.tala_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tala_tour_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tala_rental_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request; anyone can read (so the admin console lists them).
CREATE POLICY "Anyone can submit a booking request"
  ON public.tala_booking_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read booking requests"
  ON public.tala_booking_requests FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can submit a tour request"
  ON public.tala_tour_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read tour requests"
  ON public.tala_tour_requests FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can submit a rental request"
  ON public.tala_rental_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read rental requests"
  ON public.tala_rental_requests FOR SELECT TO anon, authenticated USING (true);
