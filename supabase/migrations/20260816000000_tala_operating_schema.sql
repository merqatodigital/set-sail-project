-- ============================================
-- MARINA TERRACE — TALA OPERATING SCHEMA
-- Matches existing TEXT-ID schema
-- ============================================

-- ROOMS (new table — no existing equivalent)
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY DEFAULT ('room_' || gen_random_uuid()::text),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 2,
  rate_php NUMERIC NOT NULL,
  rate_usd NUMERIC,
  amenities JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ROOM AVAILABILITY (new table)
CREATE TABLE IF NOT EXISTS room_availability (
  id TEXT PRIMARY KEY DEFAULT ('avail_' || gen_random_uuid()::text),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  booking_id TEXT,
  notes TEXT,
  UNIQUE(room_id, date)
);

-- STAFF TASKS (new table — no existing equivalent)
CREATE TABLE IF NOT EXISTS staff_tasks (
  id TEXT PRIMARY KEY DEFAULT ('task_' || gen_random_uuid()::text),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  room_id TEXT,
  booking_id TEXT,
  status TEXT DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'tala',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CHAT LOGS (new table — no existing equivalent)
CREATE TABLE IF NOT EXISTS chat_logs (
  id TEXT PRIMARY KEY DEFAULT ('chat_' || gen_random_uuid()::text),
  guest_id TEXT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_called TEXT,
  tool_result JSONB,
  response_time_ms INT,
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_room_availability_date ON room_availability(date);
CREATE INDEX IF NOT EXISTS idx_room_availability_room ON room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks(status);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_category ON staff_tasks(category);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);

-- ROW LEVEL SECURITY
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Public can read rooms + tours_catalog
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public read tours" ON tours_catalog FOR SELECT USING (true);

-- Seed rooms
INSERT INTO rooms (name, slug, type, capacity, rate_php, amenities) VALUES
  ('Garden View Room', 'garden-view', 'garden', 2, 2500, '["wifi","hot_shower","daily_housekeeping","breakfast"]'),
  ('Sea Breeze Room', 'sea-breeze', 'sea_breeze', 2, 3500, '["wifi","hot_shower","daily_housekeeping","breakfast","ocean_view"]'),
  ('Deluxe Terrace Suite', 'deluxe-terrace', 'deluxe', 3, 5000, '["wifi","hot_shower","daily_housekeeping","breakfast","ocean_view","terrace","minibar"]'),
  ('Full Villa', 'full-villa', 'villa', 4, 7500, '["wifi","hot_shower","daily_housekeeping","breakfast","ocean_view","terrace","minibar","kitchen","private_pool"]')
ON CONFLICT (slug) DO NOTHING;

-- Seed tours into existing tours_catalog
INSERT INTO tours_catalog (id, name, description, duration, price, capacity, inclusions, active, sort_order) VALUES
  ('tour_ih_a', 'Island Hopping Tour A', 'Big Lagoon, Small Lagoon, Secret Lagoon, Seven Commandos, Shimizu Island', '8 hours', 1800, 10, ARRAY['lunch','life_vest','snorkel_gear','boat'], true, 1),
  ('tour_ih_b', 'Island Hopping Tour B', 'Cadugnon, Helicopter Island, Matinloc Shrine, Hidden Beach', '8 hours', 1600, 10, ARRAY['lunch','life_vest','snorkel_gear','boat'], true, 2),
  ('tour_ugr', 'Underground River Day Trip', 'UNESCO World Heritage Site with permits, lunch, and transport', 'Full day', 2500, 10, ARRAY['permits','lunch','van','guide'], true, 3),
  ('tour_sunset', 'Sunset Beach Tour', 'Private beach sunset experience with dinner', '5 hours', 2200, 8, ARRAY['dinner','drinks','boat'], true, 4)
ON CONFLICT (id) DO NOTHING;
