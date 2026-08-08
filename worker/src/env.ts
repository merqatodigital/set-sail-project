// Environment bindings for the Cloudflare Worker.
// Includes D1 database, Durable Object namespace, Workflows, and secrets.

export interface Env {
  // D1 database binding
  DB: D1Database;
  // Durable Object namespace for TallaAgent
  TALLA_AGENT: DurableObjectNamespace;
  // Worker Loader binding for @cloudflare/computer backends
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
  // Daily Briefing Workflow binding
  DAILY_BRIEFING?: {
    create: (options: { params: unknown; id?: string }) => Promise<{ id: string }>;
    get: (id: string) => Promise<{
      id: string;
      status: () => Promise<{
        status: string;
        output?: unknown;
        error?: string;
      }>;
    }>;
    batchCreate?: (options: { params: unknown[] }) => Promise<{ instances: Array<{ id: string }> }>;
  };
  // Secrets (set via `wrangler secret put`)
  OPENROUTER_API_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  // Feature flags
  TALLA_COMPUTER_ENABLED?: string;
}
