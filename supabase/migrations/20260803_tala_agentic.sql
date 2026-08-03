-- TALA Agentic System — Supabase SQL Migration
-- Run this in the Supabase SQL Editor to enable proactive messaging + sentiment audit.

-- 1. Proactive messages table
CREATE TABLE IF NOT EXISTS tala_proactive_messages (
  id TEXT PRIMARY KEY,
  guest_phone TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  type TEXT NOT NULL, -- checkin_reminder, checkout_reminder, tour_followup, meal_suggestion, sunset_reminder, low_inventory, welcome, general
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  sent BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for fast guest lookups
CREATE INDEX IF NOT EXISTS idx_proactive_guest_phone ON tala_proactive_messages(guest_phone);
CREATE INDEX IF NOT EXISTS idx_proactive_created ON tala_proactive_messages(created_at DESC);

-- RLS — guest can only read their own messages
ALTER TABLE tala_proactive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests can read own proactive messages"
  ON tala_proactive_messages FOR SELECT
  USING (true); -- public read for now, guest phone filter happens in app

CREATE POLICY "System can insert proactive messages"
  ON tala_proactive_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update proactive messages"
  ON tala_proactive_messages FOR UPDATE
  USING (true);

-- 2. Add sentiment column to audit log (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tala_audit_log' AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE tala_audit_log ADD COLUMN sentiment TEXT DEFAULT 'neutral';
  END IF;
END $$;

-- 3. Guest memory table (for remember_guest / recall_guest tools)
CREATE TABLE IF NOT EXISTS tala_guest_memory (
  id BIGSERIAL PRIMARY KEY,
  guest_key TEXT NOT NULL UNIQUE,
  fact TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_memory_key ON tala_guest_memory(guest_key);

ALTER TABLE tala_guest_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage guest memory"
  ON tala_guest_memory FOR ALL
  USING (true);
