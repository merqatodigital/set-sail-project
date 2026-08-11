// ---------------------------------------------------------------------------
// talaClient.ts — THE single place the browser talks to the Cloudflare
// TallaAgent Worker. Text chat, voice transcripts, CTA intents, Day Pass and
// owner Ask TALA all go through here:
//
//   browser -> ${VITE_TALA_WORKER_URL}/api/talla/chat -> TallaAgent DO -> tools
//
// Rules:
//  - ONE env var: VITE_TALA_WORKER_URL (legacy VITE_TALLA_WORKER_URL /
//    VITE_WORKER_URL are still read for backwards compatibility only).
//  - NO hardcoded worker fallback, NO fallback to the site's own origin.
//    A missing config throws a clear error instead of hitting the wrong host.
//  - role is CONTEXT ONLY. Owner privileges are granted by the Worker after it
//    verifies the forwarded Supabase access token — never by this field.
// ---------------------------------------------------------------------------

export const TALA_TENANT = "marina_terrace";

const MISSING =
  "TALA is not configured: VITE_TALA_WORKER_URL is missing. Set it to the deployed Cloudflare Worker URL.";

/** Resolve the Cloudflare Worker base URL. Throws when unconfigured. */
export function talaWorkerBase(): string {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const raw =
    env.VITE_TALA_WORKER_URL ||
    // deprecated names, kept only so an already-configured deploy keeps working
    env.VITE_TALLA_WORKER_URL ||
    env.VITE_WORKER_URL ||
    "";
  const base = raw.trim().replace(/\/+$/, "");
  if (!base || !/^https?:\/\//i.test(base)) throw new Error(MISSING);
  return base;
}

/** Non-throwing variant for status/diagnostic surfaces. */
export function talaWorkerBaseOrNull(): string | null {
  try {
    return talaWorkerBase();
  } catch {
    return null;
  }
}

export interface TalaChatResult {
  content: string | null;
  model?: string;
  usage?: unknown;
}

export interface TalaChatInput {
  message: string;
  /** Context hint only — the Worker authorizes owners via the bearer token. */
  role?: "guest" | "owner";
  /** Stable session id so the Durable Object remembers this conversation. */
  userId: string;
  tenantId?: string;
  model?: string;
  /** Supabase access token, forwarded for owner/admin authorization. */
  authToken?: string;
  guestName?: string;
  guestRoom?: string;
  signal?: AbortSignal;
}

/** Single POST to the Cloudflare TallaAgent. */
export async function talaChat(input: TalaChatInput): Promise<TalaChatResult> {
  const base = talaWorkerBase();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.authToken) headers.Authorization = `Bearer ${input.authToken}`;
  const res = await fetch(`${base}/api/talla/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: input.message,
      tenantId: input.tenantId ?? TALA_TENANT,
      role: input.role ?? "guest",
      userId: input.userId,
      model: input.model || undefined,
      guestName: input.guestName,
      guestRoom: input.guestRoom,
    }),
    signal: input.signal,
  });
  const data = (await res.json().catch(() => null)) as
    | { content?: string; error?: string; model?: string; usage?: unknown }
    | null;
  if (!res.ok) throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  return { content: data?.content ?? null, model: data?.model, usage: data?.usage };
}

/** Current Supabase access token, or "" when nobody is signed in. */
export async function talaOwnerToken(): Promise<string> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  } catch {
    return "";
  }
}

/** Signed-in user id (stable owner session key), or null. */
export async function talaOwnerUserId(): Promise<string | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}