-- ===========================================================================
-- TALA deterministic lifecycle: persist short human references + contact parity
-- for tour and motorbike rental requests, so the SAME authoritative rows the
-- Admin/Portal uses carry a TT-XXXX / MR-XXXX reference (never the internal UUID)
-- and guest_email for parity with tala_booking_requests.
--
-- Idempotent: safe to run more than once (ADD COLUMN IF NOT EXISTS).
-- DAVID RUNS THIS MANUALLY in the Supabase SQL editor. Hermes does NOT apply it.
-- ===========================================================================

ALTER TABLE public.tala_tour_requests
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_email TEXT NOT NULL DEFAULT '';

ALTER TABLE public.tala_rental_requests
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_email TEXT NOT NULL DEFAULT '';

-- Indexes for dedupe lookups (guest/name/date/status).
CREATE INDEX IF NOT EXISTS idx_tala_tour_requests_ref
  ON public.tala_tour_requests (reference);
CREATE INDEX IF NOT EXISTS idx_tala_rental_requests_ref
  ON public.tala_rental_requests (reference);
