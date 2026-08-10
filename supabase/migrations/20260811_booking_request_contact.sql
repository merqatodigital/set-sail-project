-- Booking request contact + reference columns (Hermes, agent/hermes-tala-runtime).
-- DAVID RUNS THIS MANUALLY IN SUPABASE SQL EDITOR. Do NOT run from worker/CLI.
-- Adds contact persistence (email, phone) and a short human reference to
-- tala_booking_requests so requestRoomBooking can store guest contact and return
-- MT-YYYYMMDD-XXXX instead of the raw UUID.

ALTER TABLE public.tala_booking_requests
  ADD COLUMN IF NOT EXISTS guest_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tala_booking_requests_reference
  ON public.tala_booking_requests (reference);

-- Backfill reference for any pre-existing rows (best-effort, idempotent).
UPDATE public.tala_booking_requests
SET reference = 'MT-'
  || COALESCE(REPLACE(check_in, '-', ''), '00000000')
  || '-'
  || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4)
WHERE reference = '';
