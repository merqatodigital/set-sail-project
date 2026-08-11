-- ===========================================================================
-- Seed motorbike inventory (DATA ONLY — not a schema migration).
-- The motorbikes table existed but was empty, so requestRental had no
-- authoritative rate to look up. This inserts two real bikes.
-- IDEMPOTENT: ON CONFLICT (id) DO NOTHING — safe to re-run; never drops or
-- alters schema, never touches other tables.
-- DAVID: run this once in the Supabase SQL editor.
-- ===========================================================================

INSERT INTO public.motorbikes (id, name, plate, model, daily_rate, active, status, notes)
VALUES
  ('mb-honda-click-150', 'Honda Click 150', 'PAL-001', 'Click 150', 500, true, 'available', ''),
  ('mb-yamaha-mio-125',  'Yamaha Mio 125',  'PAL-002', 'Mio 125',  450, true, 'available', '')
ON CONFLICT (id) DO NOTHING;
