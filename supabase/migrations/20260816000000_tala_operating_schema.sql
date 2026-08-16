-- ============================================
-- MARINA TERRACE — TALA OPERATING SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- ROOMS
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ROOM AVAILABILITY (per date)
CREATE TABLE IF NOT EXISTS room_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'available',
  booking_id UUID,
  notes TEXT,
  UNIQUE(room_id, date)
);

-- GUESTS
CREATE TABLE IF NOT EXISTS guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nationality TEXT,
  whatsapp TEXT,
  telegram TEXT,
  notes TEXT,
  total_stays INT DEFAULT 0,
  total_spent_php NUMERIC DEFAULT 0,
  is_vip BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  guest_id UUID REFERENCES guests(id),
  room_id UUID REFERENCES rooms(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests INT DEFAULT 2,
  status TEXT DEFAULT 'inquiry',
  total_php NUMERIC NOT NULL,
  deposit_php NUMERIC DEFAULT 0,
  balance_php NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  payment_method TEXT,
  special_requests TEXT,
  source TEXT DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TOUR PACKAGES
CREATE TABLE IF NOT EXISTS tours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_php NUMERIC NOT NULL,
  price_usd NUMERIC,
  duration TEXT,
  max_pax INT DEFAULT 10,
  min_pax INT DEFAULT 2,
  inclusions JSONB DEFAULT '[]',
  schedule JSONB DEFAULT '[]',
  operator_name TEXT,
  operator_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TOUR BOOKINGS
CREATE TABLE IF NOT EXISTS tour_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID REFERENCES tours(id),
  booking_id UUID REFERENCES bookings(id),
  guest_id UUID REFERENCES guests(id),
  date DATE NOT NULL,
  num_pax INT NOT NULL,
  total_php NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TRANSPORT
CREATE TABLE IF NOT EXISTS transport_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  guest_id UUID REFERENCES guests(id),
  type TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  pickup_location TEXT,
  dropoff_location TEXT,
  num_pax INT DEFAULT 1,
  price_php NUMERIC,
  driver_name TEXT,
  driver_phone TEXT,
  vehicle TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- STAFF TASKS
CREATE TABLE IF NOT EXISTS staff_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  room_id UUID REFERENCES rooms(id),
  booking_id UUID REFERENCES bookings(id),
  status TEXT DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'tala',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  guest_id UUID REFERENCES guests(id),
  amount_php NUMERIC NOT NULL,
  amount_usd NUMERIC,
  method TEXT NOT NULL,
  type TEXT DEFAULT 'charge',
  status TEXT DEFAULT 'pending',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CHAT LOGS
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id),
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
CREATE INDEX IF NOT EXISTS idx_availability_date ON room_availability(date);
CREATE INDEX IF NOT EXISTS idx_availability_room ON room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON staff_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON staff_tasks(category);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- ROW LEVEL SECURITY
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Public can read rooms + tours (marketing content)
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public read active tours" ON tours FOR SELECT USING (is_active = true);

-- Seed rooms
INSERT INTO rooms (name, slug, type, capacity, rate_php, amenities) VALUES
  ('Garden View Room', 'garden-view', 'garden', 2, 2500, '["wifi","hot_shower","daily_housekeeping","breakfast"]'),
  ('Sea Breeze Room', 'sea-breeze', 'sea_breeze', 2, 3500, '["wifi","hot_shower","daily_housekeeping","breakfast","ocean_view"]'),
  ('Deluxe Terrace Suite', 'deluxe-terrace', 'deluxe', 3, 5000, '["wifi","hot_shower","daily_housekeeping","breakfast","ocean_view","terrace","minibar"]'),
  ('Full Villa', 'full-villa', 'villa', 4, 7500, '["wifi","hot_shower","daily_housekeeping","breakfast","ocean_view","terrace","minibar","kitchen","private_pool"]')
ON CONFLICT (slug) DO NOTHING;

-- Seed tours
INSERT INTO tours (name, slug, description, price_php, duration, max_pax, min_pax, inclusions) VALUES
  ('Island Hopping Tour A', 'island-hopping-a', 'Big Lagoon, Small Lagoon, Secret Lagoon, Seven Commandos, Shimizu Island', 1800, '8 hours', 10, 4, '["lunch","life_vest","snorkel_gear","boat"]'),
  ('Island Hopping Tour B', 'island-hopping-b', 'Cadugnon, Helicopter Island, Matinloc Shrine, Hidden Beach', 1600, '8 hours', 10, 4, '["lunch","life_vest","snorkel_gear","boat"]'),
  ('Underground River Day Trip', 'underground-river', 'UNESCO World Heritage Site with permits, lunch, and transport', 2500, 'Full day', 10, 2, '["permits","lunch","van","guide"]'),
  ('Sunset Beach Tour', 'sunset-beach', 'Private beach sunset experience with dinner', 2200, '5 hours', 8, 2, '["dinner","boat","drinks"]')
ON CONFLICT (slug) DO NOTHING;
