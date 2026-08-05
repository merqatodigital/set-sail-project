-- Server-only bridge. It is deliberately callable only by the Supabase service role.
-- The TALA server uses it to call OpenRouter without returning any secret to the browser.
create or replace function public.hermes_runtime_config(p_resort_id text)
returns table (
  provider text,
  openrouter_model text,
  ollama_base_url text,
  ollama_model text,
  supabase_url text,
  github_repository text,
  resend_from_email text,
  openrouter_api_key text,
  supabase_service_role_key text,
  github_token text,
  resend_api_key text
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select
    s.provider,
    s.openrouter_model,
    s.ollama_base_url,
    s.ollama_model,
    s.supabase_url,
    s.github_repository,
    s.resend_from_email,
    k.openrouter_api_key,
    k.supabase_service_role_key,
    k.github_token,
    k.resend_api_key
  from public.hermes_settings s
  left join private.hermes_secrets k on k.resort_id = s.resort_id
  where s.resort_id = p_resort_id;
$$;

revoke all on function public.hermes_runtime_config(text) from public;
revoke all on function public.hermes_runtime_config(text) from anon;
revoke all on function public.hermes_runtime_config(text) from authenticated;
grant execute on function public.hermes_runtime_config(text) to service_role;
