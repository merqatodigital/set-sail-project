// Feature flag for Cloudflare Talla agent.
// Controls whether to use the new Cloudflare TallaAgent or legacy Talla.

/**
 * Check if the Cloudflare Talla agent is enabled.
 * Uses VITE_TALLA_CLOUDFLARE_AGENT env var.
 * Defaults to false (legacy Talla) for safe rollback.
 */
export function isCloudflareTallaEnabled(): boolean {
  return import.meta.env.VITE_TALLA_CLOUDFLARE_AGENT === "true";
}

/**
 * Get the Cloudflare Worker URL for the TallaAgent.
 */
export function getTallaAgentUrl(): string {
  return (
    import.meta.env.VITE_WORKER_URL ||
    "https://talla-agent-staging.merqato-digital.workers.dev"
  );
}
