-- =============================================================
-- SECURITY FIX MIGRATION — Run in Supabase SQL Editor
-- Fixes: RLS policies, creates missing tables
-- =============================================================

-- 1. LOCK DOWN cms_data — remove anon write, restrict to authenticated
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can write CMS data" ON cms_data;
  DROP POLICY IF EXISTS "Public can read cms_data" ON cms_data;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Authenticated users can read cms_data"
  ON cms_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can write cms_data"
  ON cms_data FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. LOCK DOWN tala_leads
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_leads" ON tala_leads;
  DROP POLICY IF EXISTS "Allow public read on tala_leads" ON tala_leads;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Anonymous can insert leads"
  ON tala_leads FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can read leads"
  ON tala_leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update leads"
  ON tala_leads FOR UPDATE
  TO authenticated
  USING (true);

-- 3. LOCK DOWN tala_booking_requests
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_booking_requests" ON tala_booking_requests;
  DROP POLICY IF EXISTS "Allow public read on tala_booking_requests" ON tala_booking_requests;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Anonymous can insert booking requests"
  ON tala_booking_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can read booking requests"
  ON tala_booking_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update booking requests"
  ON tala_booking_requests FOR UPDATE
  TO authenticated
  USING (true);

-- 4. LOCK DOWN tala_tour_requests
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_tour_requests" ON tala_tour_requests;
  DROP POLICY IF EXISTS "Allow public read on tala_tour_requests" ON tala_tour_requests;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Anonymous can insert tour requests"
  ON tala_tour_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can read tour requests"
  ON tala_tour_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update tour requests"
  ON tala_tour_requests FOR UPDATE
  TO authenticated
  USING (true);

-- 5. LOCK DOWN tala_rental_requests
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_rental_requests" ON tala_rental_requests;
  DROP POLICY IF EXISTS "Allow public read on tala_rental_requests" ON tala_rental_requests;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Anonymous can insert rental requests"
  ON tala_rental_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can read rental requests"
  ON tala_rental_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update rental requests"
  ON tala_rental_requests FOR UPDATE
  TO authenticated
  USING (true);

-- 6. LOCK DOWN tala_audit_log
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read on tala_audit_log" ON tala_audit_log;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Authenticated can read audit log"
  ON tala_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- 7. CREATE tala_proactive_messages (if not exists) + set RLS
CREATE TABLE IF NOT EXISTS tala_proactive_messages (
  id TEXT PRIMARY KEY,
  guest_phone TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  sent BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_proactive_guest_phone ON tala_proactive_messages(guest_phone);
CREATE INDEX IF NOT EXISTS idx_proactive_created ON tala_proactive_messages(created_at DESC);

ALTER TABLE tala_proactive_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Guests can read own proactive messages" ON tala_proactive_messages;
  DROP POLICY IF EXISTS "System can insert proactive messages" ON tala_proactive_messages;
  DROP POLICY IF EXISTS "System can update proactive messages" ON tala_proactive_messages;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Anonymous can insert proactive messages"
  ON tala_proactive_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can read proactive messages"
  ON tala_proactive_messages FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can manage proactive messages"
  ON tala_proactive_messages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. CREATE tala_guest_memory (if not exists) + set RLS
CREATE TABLE IF NOT EXISTS tala_guest_memory (
  id BIGSERIAL PRIMARY KEY,
  guest_key TEXT NOT NULL UNIQUE,
  fact TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_memory_key ON tala_guest_memory(guest_key);

ALTER TABLE tala_guest_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "System can manage guest memory" ON tala_guest_memory;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Authenticated can manage guest memory"
  ON tala_guest_memory FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 9. LOCK DOWN tala_goals, tala_tasks, tala_briefings, tala_wins
DO $$ BEGIN
  -- Goals
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_goals" ON tala_goals;
  DROP POLICY IF EXISTS "Allow public read on tala_goals" ON tala_goals;
  CREATE POLICY "Authenticated can manage goals"
    ON tala_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- Tasks
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_tasks" ON tala_tasks;
  DROP POLICY IF EXISTS "Allow public read on tala_tasks" ON tala_tasks;
  CREATE POLICY "Authenticated can manage tasks"
    ON tala_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- Briefings
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_briefings" ON tala_briefings;
  DROP POLICY IF EXISTS "Allow public read on tala_briefings" ON tala_briefings;
  CREATE POLICY "Authenticated can manage briefings"
    ON tala_briefings FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- Wins
  DROP POLICY IF EXISTS "Allow anonymous insert on tala_wins" ON tala_wins;
  DROP POLICY IF EXISTS "Allow public read on tala_wins" ON tala_wins;
  CREATE POLICY "Authenticated can manage wins"
    ON tala_wins FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 10. Add sentiment column to tala_audit_log if missing
DO $$ BEGIN
  ALTER TABLE tala_audit_log ADD COLUMN sentiment TEXT DEFAULT 'neutral';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
