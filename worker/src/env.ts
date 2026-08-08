// Environment bindings for the Cloudflare Worker.
// Includes D1 database, Durable Object namespace, and secrets.

export interface Env {
  // D1 database binding
  DB: D1Database;
  // Durable Object namespace for TallaAgent
  TALLA_AGENT: DurableObjectNamespace;
  // Secrets (set via `wrangler secret put`)
  OPENROUTER_API_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}
