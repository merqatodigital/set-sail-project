-- ===========================================================================
-- Inventory — linens, towels, bathroom supplies, food, gas (gasul/LPG), fuel
-- ===========================================================================
-- New entity, not something that ever lived in cms_data — admin asked for a
-- basic stock-tracking table so TALA and the admin console can see what's
-- running low. Same pattern as the operations_tables migration: its own
-- table, admin-only for both read and write via has_role(auth.uid(),
-- 'admin'). No guest use case at all, so no anon exceptions here.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity NUMERIC NOT NULL DEFAULT 0,
  reorder_threshold NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

DROP POLICY IF EXISTS "Admins can manage inventory_items" ON public.inventory_items;
CREATE POLICY "Admins can manage inventory_items"
  ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- select has_table_privilege('anon', 'public.inventory_items', 'SELECT'); -- expect: false
