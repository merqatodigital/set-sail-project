-- Phase 3: D1 Schema Foundation
-- Multi-tenant resort management database
-- Every business table includes tenant_id for isolation.

-- Tenants (resorts/properties)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tenant members (links users to tenants with roles)
CREATE TABLE IF NOT EXISTS tenant_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

-- Tours catalog (read vertical slice)
CREATE TABLE IF NOT EXISTS tours_catalog (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 1,
  inclusions TEXT DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tours_catalog_tenant ON tours_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tours_catalog_active ON tours_catalog(tenant_id, active);

-- Tour bookings
CREATE TABLE IF NOT EXISTS tour_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  reference TEXT NOT NULL DEFAULT '',
  tour_id TEXT NOT NULL DEFAULT '',
  tour_name TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  guests INTEGER NOT NULL DEFAULT 1,
  amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_tenant ON tour_bookings(tenant_id);

-- Guest requests (write vertical slice)
CREATE TABLE IF NOT EXISTS guest_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL,
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  guest_email TEXT NOT NULL DEFAULT '',
  room_type TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  tour_name TEXT NOT NULL DEFAULT '',
  tour_date TEXT NOT NULL DEFAULT '',
  bike_name TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  guests INTEGER NOT NULL DEFAULT 1,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'talla_chat',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guest_requests_tenant ON guest_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_requests_type ON guest_requests(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_guest_requests_status ON guest_requests(tenant_id, status);
