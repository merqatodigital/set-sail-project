-- ---------------------------------------------------------------------------
-- AMUMA Circle — Founding Circle application table + TALA knowledge seed
-- Run this in the Supabase SQL Editor to enable the investment feature.
-- ---------------------------------------------------------------------------

-- 1. Applications table
CREATE TABLE IF NOT EXISTS public.amuma_applications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  country     TEXT,
  heard_from  TEXT,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'contacted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin listing (newest first)
CREATE INDEX IF NOT EXISTS idx_amuma_applications_created_at
  ON public.amuma_applications (created_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_amuma_applications_status
  ON public.amuma_applications (status);

-- 2. Row-Level Security
ALTER TABLE public.amuma_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public application form)
CREATE POLICY "Anyone can submit an application"
  ON public.amuma_applications
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can read applications"
  ON public.amuma_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Only admins can update (status changes)
CREATE POLICY "Admins can update applications"
  ON public.amuma_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- 3. TALA knowledge seed — investment facts for the Cloudflare agent
-- The worker reads tala_knowledge live, so no worker redeploy is needed.
INSERT INTO public.tala_knowledge (category, fact)
VALUES
  ('investment', 'AMUMA is a membership-based boutique resort collection. The Visayan word means to nurture, to care for, and to tend with attention.'),
  ('investment', 'AMUMA Circle members acquire Circle Units, investment shares in a specific destination. Each unit grants co-creation rights and revenue participation.'),
  ('investment', 'Revenue is distributed 60% to Circle Members and 40% to the AMUMA Operator after operating expenses and a 5% TIEZA tourism tax.'),
  ('investment', 'AMUMA offers four investment tiers: Nova (500,000 PHP, 50 Units, 1,000 Pebbles), Aurora (1,200,000 PHP, 120 Units, 2,200 Pebbles), Orion (2,000,000 PHP, 210 Units, 4,000 Pebbles), Polaris (4,000,000 PHP, 440 Units, 8,000 Pebbles).'),
  ('investment', 'The Founding Circle is limited to 20 Nova spots at 500,000 PHP each. Founding Circle members get 50 units (1.79% ownership), 1,000 annual Pebbles, early access to future retreats, name on the founding plaque, and an invitation to the annual Founders Dinner.'),
  ('investment', 'Projected annual ROI for Circle Members is 17 to 20%, based on conservative 55% occupancy assumptions. A Nova investor can expect 85,000 to 100,000 PHP annual return on a 500,000 PHP investment.'),
  ('investment', 'Pebbles is AMUMA internal lifestyle currency. Members receive Pebbles annually to spend on suite nights, dining, excursions, boat trips, and spa treatments. Suites cost 150 to 300 Pebbles per night, Villas 275 to 500 Pebbles per night depending on season.'),
  ('investment', 'The first AMUMA retreat is in San Vicente, Palawan, 4 Suites and 2 Villas on Long Beach. Total 4,400 Circle Units. AMUMA Holding develops 1,600 units as proof of work; 2,800 are member-held.'),
  ('investment', 'AMUMA Hidden Destinations pipeline includes Balabac (Palawan), Bukidnon, Siquijor, Sibuyan Island, Luang Prabang (Laos), Togean Islands (Indonesia), and Timor.'),
  ('investment', 'The AMUMA roadmap: San Vicente construction begins 2026, opens 2028. Balabac groundbreaking 2029, opens 2031. Indonesia (Togean Islands) targeted for 2035.'),
  ('investment', 'Founding team: Giacomo Gervasutti (Founder and Vision Director, owns Baia Boutique Resort and Marina Terrace), Irina Feleo (Cofounder and Creative Director), Joaquin Esquivias (Chief Legal and Strategy Officer).'),
  ('investment', 'The Member Portal webapp lets members reserve suites with Pebbles, book experiences, track Pebble balance and profits, send and receive Pebble gifts, message resort staff, and vote on club decisions.'),
  ('investment', 'To apply for the Founding Circle, visit /investment on the website or ask me to open the application form. Applications are reviewed by the founding team.')
ON CONFLICT DO NOTHING;
