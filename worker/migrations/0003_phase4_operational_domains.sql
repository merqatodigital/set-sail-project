-- Phase 4: Core Operational Domains
-- Extends Phase 3 schema with property settings, housekeeping, maintenance,
-- menu/food orders, inventory, and Talla tasks/leads.
-- Every tenant-owned table includes tenant_id for isolation.

-- ============================================================
-- A. PROPERTY / RESORT SETTINGS
-- ============================================================
-- Structured key-value settings per tenant.
-- Replaces the monolithic CMS JSON blob for operational settings.
-- Each setting is a separate row for granular access.

CREATE TABLE IF NOT EXISTS property_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  category TEXT NOT NULL DEFAULT 'general',
  key TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_settings_tenant_key ON property_settings(tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_property_settings_category ON property_settings(tenant_id, category);

-- ============================================================
-- C. HOUSEKEEPING
-- ============================================================
-- Housekeeping tasks for room/area cleaning and maintenance.

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  room TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  task_type TEXT NOT NULL DEFAULT 'cleaning',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_tenant ON housekeeping_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_room ON housekeeping_tasks(tenant_id, room);

-- ============================================================
-- D. MAINTENANCE
-- ============================================================
-- Maintenance requests for property issues and repairs.

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  issue_type TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(tenant_id, status);

-- ============================================================
-- E. MENU / FOOD ORDERS
-- ============================================================
-- Menu items available for guest ordering.
-- Prices are authoritative server-side only.

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  price REAL NOT NULL DEFAULT 0,
  food_cost REAL NOT NULL DEFAULT 0,
  inventory_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(tenant_id, active);

-- Food orders placed by guests.

CREATE TABLE IF NOT EXISTS food_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  reference TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  preparing_at TEXT,
  ready_at TEXT,
  delivered_at TEXT,
  cancelled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_food_orders_tenant ON food_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_food_orders_status ON food_orders(tenant_id, status);

-- Food order line items (each item in an order).

CREATE TABLE IF NOT EXISTS food_order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  order_id TEXT NOT NULL REFERENCES food_orders(id),
  menu_item_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  food_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_food_order_items_order ON food_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_food_order_items_tenant ON food_order_items(tenant_id);

-- ============================================================
-- F. INVENTORY
-- ============================================================
-- Inventory items for tracking stock levels.

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity REAL NOT NULL DEFAULT 0,
  reorder_threshold REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(tenant_id, category);

-- ============================================================
-- G. TALLA TASKS / LEADS / GOALS / BRIEFINGS / WINS
-- ============================================================
-- Operational data used by Talla AI agent.

CREATE TABLE IF NOT EXISTS tala_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL DEFAULT '',
  due TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tala_tasks_tenant ON tala_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tala_tasks_status ON tala_tasks(tenant_id, status);

CREATE TABLE IF NOT EXISTS tala_leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'talla_chat',
  source_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tala_leads_tenant ON tala_leads(tenant_id);

CREATE TABLE IF NOT EXISTS tala_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  target_date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tala_goals_tenant ON tala_goals(tenant_id);

CREATE TABLE IF NOT EXISTS tala_briefings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  brief_date TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  highlights TEXT DEFAULT '[]',
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  whatsapp_sent INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tala_briefings_tenant ON tala_briefings(tenant_id);

CREATE TABLE IF NOT EXISTS tala_wins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  brief_date TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tala_wins_tenant ON tala_wins(tenant_id);
