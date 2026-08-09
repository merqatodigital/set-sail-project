// Environment bindings for the Cloudflare Worker.
// Includes D1 database, Durable Object namespace, Workflows, and secrets.

import type { EmailSendBinding } from "agents";

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
  // Cloudflare Agents Email API — send_email binding (outbound email)
  EMAIL?: EmailSendBinding;
  // Secret for signing agent reply-routing headers (HMAC). Optional in dev.
  EMAIL_SECRET?: string;
  // Webhook signature secret for event ingestion (HMAC-SHA256).
  WEBHOOK_SECRET?: string;
  // Cloudflare AI Search config (values from env only — never hardcoded).
  AI_SEARCH_ACCOUNT_ID?: string;
  AI_SEARCH_INDEX?: string;
  AI_SEARCH_TOKEN?: string;
  // Cloudflare Browser Run binding (Quick Actions: markdown/links/screenshot…).
  BROWSER?: { quickAction(action: string, options: unknown): Promise<Response> };
  // Secrets (set via `wrangler secret put`)
  OPENROUTER_API_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  // Feature flags
  TALLA_COMPUTER_ENABLED?: string;
  // Environment mode: "development" or "production"
  // Set via wrangler.jsonc vars or environment variable
  ENVIRONMENT?: string;
}

/**
 * Check if we're in development mode.
 * Returns true only when ENVIRONMENT is explicitly set to "development".
 * This guards the X-Dev-Tenant header bypass to prevent production auth bypass.
 */
export function isDevelopmentMode(env: Env): boolean {
  return env.ENVIRONMENT === "development";
}
