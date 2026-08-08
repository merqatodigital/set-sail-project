// Environment bindings for the Cloudflare Worker.
// Includes D1 database, Durable Object namespace, and secrets.

export interface Env {
  // D1 database binding
  DB: D1Database;
  // Durable Object namespace for TallaAgent
  TALLA_AGENT: DurableObjectNamespace;
  // Worker Loader binding for @cloudflare/computer backends
  // This is a Cloudflare runtime binding — the type matches WorkspaceRuntimeLoader
  // from @cloudflare/computer. Using a compatible structural type.
  LOADER: {
    load(code: {
      compatibilityDate: string;
      compatibilityFlags?: string[];
      limits?: { cpuMs?: number };
      mainModule: string;
      modules: Record<string, string | { js?: string }>;
      globalOutbound?: unknown;
    }): {
      getEntrypoint(name?: string, options?: { limits?: { cpuMs?: number } }): unknown;
    };
  };
  // Secrets (set via `wrangler secret put`)
  OPENROUTER_API_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  // Feature flags
  TALLA_COMPUTER_ENABLED?: string;
}
