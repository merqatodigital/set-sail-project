-- ===========================================================================
-- Admin auth hardening + RLS lockdown
-- ===========================================================================
-- Problem being fixed:
--   1. Admin access was a client-side passkey ("5309" by default, committed
--      in plain text to this public repo) compared entirely in the browser.
--      Postgres never saw it — every write from the admin panel reached
--      Supabase as the same `anon` role as any site visitor.
--   2. cms_data (rooms, pricing, blog, AND all operations data — bookings,
--      payroll, revenue, expenses) was `GRANT INSERT, UPDATE, DELETE ...
--      TO anon` with a `USING (true)` policy: anyone holding the public
--      anon key (shipped in the built JS — meant to be public) could
--      rewrite or wipe the entire row with a single REST call, no login of
--      any kind required.
--   3. tala_leads and tala_audit_log were SELECT-open to anon — guest PII
--      and the agent's audit trail were world-readable.
--   4. tala_goals / tala_tasks / tala_briefings / tala_wins (the owner's
--      ops console) were SELECT + INSERT open to anon with no gate at all
--      beyond "the UI has a passkey".
--
-- Fix: real Supabase Auth for /admin (src/context/AuthContext.tsx), a
-- user_roles table + has_role() helper (SECURITY DEFINER so it can read
-- user_roles without tripping that table's own RLS), and policies gated on
-- has_role(auth.uid(), 'admin').
--
-- Safe to re-run (DROP POLICY IF EXISTS / CREATE OR REPLACE throughout).
--
-- AFTER this migration is applied AND the app is deployed with the new
-- AuthContext, create your first admin user (see TALA.md):
--   1. Supabase Dashboard -> Authentication -> Users -> Add user
--      (email + password).
--   2. Copy that user's UID.
--   3. SQL Editor:
--        insert into public.user_roles (user_id, role)
--        values ('<uid>', 'admin');
--   4. Reload /admin and sign in with that email/password.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER + fixed search_path so this can be called from any RLS
-- policy without granting callers direct access to user_roles (which would
-- otherwise recurse: reading user_roles' own RLS would call has_role again).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
CREATE POLICY "Admins manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. cms_data — public SELECT stays (the public site renders from it);
--    writes now require an authenticated admin. This closes the
--    "anyone can rewrite/wipe the whole site + operations data" hole.
--    NOTE: operations data (bookings/payroll/revenue) still lives inside
--    this same public-readable JSON blob — splitting it into its own
--    admin-only table is a recommended follow-up, out of scope here.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.cms_data FROM anon;

DROP POLICY IF EXISTS "Anyone can write CMS data" ON public.cms_data;
DROP POLICY IF EXISTS "Authenticated can write CMS data" ON public.cms_data;
CREATE POLICY "Admins can write CMS data"
  ON public.cms_data FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3. tala_leads — guests can still submit a lead anonymously (TALA needs
--    this from the public chat widget); only admins can read/manage them.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.tala_leads FROM anon;
GRANT UPDATE, DELETE ON public.tala_leads TO authenticated;

DROP POLICY IF EXISTS "Anyone can read leads" ON public.tala_leads;
CREATE POLICY "Admins can read leads"
  ON public.tala_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update leads" ON public.tala_leads;
CREATE POLICY "Admins can update leads"
  ON public.tala_leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete leads" ON public.tala_leads;
CREATE POLICY "Admins can delete leads"
  ON public.tala_leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4. tala_audit_log — TALA keeps logging fire-and-forget from the browser
--    (INSERT stays open); only admins can read the trail.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.tala_audit_log FROM anon;

DROP POLICY IF EXISTS "Anyone can read audit entries" ON public.tala_audit_log;
CREATE POLICY "Admins can read audit entries"
  ON public.tala_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 5. tala_goals / tala_tasks / tala_briefings / tala_wins — the owner's ops
--    console, not guest-facing. No legitimate anon use case; lock fully to
--    admin. (tala_briefings also gets UPDATE for the whatsapp_sent toggle.)
-- ---------------------------------------------------------------------------
REVOKE SELECT, INSERT ON public.tala_goals FROM anon;
REVOKE SELECT, INSERT ON public.tala_tasks FROM anon;
REVOKE SELECT, INSERT ON public.tala_briefings FROM anon;
REVOKE SELECT, INSERT ON public.tala_wins FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tala_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tala_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tala_briefings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tala_wins TO authenticated;

DROP POLICY IF EXISTS "Anyone can add a goal" ON public.tala_goals;
DROP POLICY IF EXISTS "Anyone can read goals" ON public.tala_goals;
CREATE POLICY "Admins can manage goals"
  ON public.tala_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can add a task" ON public.tala_tasks;
DROP POLICY IF EXISTS "Anyone can read tasks" ON public.tala_tasks;
CREATE POLICY "Admins can manage tasks"
  ON public.tala_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can add a briefing" ON public.tala_briefings;
DROP POLICY IF EXISTS "Anyone can read briefings" ON public.tala_briefings;
CREATE POLICY "Admins can manage briefings"
  ON public.tala_briefings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can add a win" ON public.tala_wins;
DROP POLICY IF EXISTS "Anyone can read wins" ON public.tala_wins;
CREATE POLICY "Admins can manage wins"
  ON public.tala_wins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 6. generate_tala_briefing() (pg_cron function) inserts as its invoking
--    role. It's defined SECURITY INVOKER by default in the earlier
--    migration and was relying on the now-removed anon INSERT grant when
--    called manually from the admin "Generate briefing" button. Since that
--    button only runs inside an authenticated admin session now, and
--    pg_cron itself runs as `postgres` (which bypasses RLS), no change to
--    the function is required — this comment documents why.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. Verification queries (run after applying; sanity-check the lockdown)
-- ---------------------------------------------------------------------------
-- select has_table_privilege('anon', 'public.cms_data', 'UPDATE');       -- expect: false
-- select has_table_privilege('anon', 'public.tala_leads', 'SELECT');     -- expect: false
-- select has_table_privilege('anon', 'public.tala_audit_log', 'SELECT'); -- expect: false
-- select has_table_privilege('anon', 'public.tala_goals', 'SELECT');     -- expect: false
