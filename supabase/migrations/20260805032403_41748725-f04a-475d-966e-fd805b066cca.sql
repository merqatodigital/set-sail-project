DROP FUNCTION IF EXISTS public.hermes_runtime_config(text);
DROP FUNCTION IF EXISTS public.hermes_secret_status(text);
DROP FUNCTION IF EXISTS public.save_hermes_secrets(text, text, text, text, text, text);

ALTER TABLE public.hermes_settings DROP COLUMN IF EXISTS runtime_url;
ALTER TABLE public.hermes_settings DROP COLUMN IF EXISTS supabase_url;

CREATE TABLE IF NOT EXISTS public.hermes_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id text NOT NULL DEFAULT 'marina_terrace',
  agent text NOT NULL,
  model text NOT NULL DEFAULT '',
  request text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  task_id uuid,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hermes_runs TO authenticated;
GRANT ALL ON public.hermes_runs TO service_role;

ALTER TABLE public.hermes_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resort owners can read hermes runs"
ON public.hermes_runs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.resort_members m
  WHERE m.resort_id = hermes_runs.resort_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
));

CREATE POLICY "Resort owners can create hermes runs"
ON public.hermes_runs FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.resort_members m
  WHERE m.resort_id = hermes_runs.resort_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
));

CREATE INDEX IF NOT EXISTS hermes_runs_created_at_idx ON public.hermes_runs (created_at DESC);