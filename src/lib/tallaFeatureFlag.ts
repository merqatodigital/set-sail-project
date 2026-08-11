// Cloudflare TallaAgent is now the ONLY TALA runtime. This file is kept as a
// thin re-export of the single URL resolver in src/lib/talaClient.ts so older
// imports keep working; there is no second brain and no hardcoded fallback.

import { talaWorkerBase } from "./talaClient";

/** Cloudflare TallaAgent is always the runtime now. */
export function isCloudflareTallaEnabled(): boolean {
  return true;
}

/** Configured Cloudflare Worker URL (throws when VITE_TALA_WORKER_URL is unset). */
export function getTallaAgentUrl(): string {
  return talaWorkerBase();
}
