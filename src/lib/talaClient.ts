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
//  - Interactive chat uses the Worker's existing SSE path so text appears as
//    soon as the model emits it instead of waiting for the full completion.
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
  /** Called with each user-visible SSE text delta and the accumulated reply. */
  onDelta?: (delta: string, accumulated: string) => void;
}

interface TalaSseEvent {
  type?: string;
  text?: string;
  content?: string;
  model?: string;
  usage?: unknown;
  error?: string;
}

/**
 * Parse the Worker's SSE stream. The server sends only user-visible text
 * deltas; tool JSON and internal reasoning never reach this callback.
 */
async function readTalaStream(
  res: Response,
  onDelta: (delta: string, accumulated: string) => void,
): Promise<TalaChatResult> {
  if (!res.body) throw new Error("TALA returned an empty stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let finalContent = "";
  let model: string | undefined;
  let usage: unknown;

  const consumeEvent = (raw: string) => {
    const lines = raw.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let event: TalaSseEvent;
      try {
        event = JSON.parse(payload) as TalaSseEvent;
      } catch {
        continue;
      }

      if (event.type === "text" && event.text) {
        accumulated += event.text;
        onDelta(event.text, accumulated);
      } else if (event.type === "done") {
        finalContent = event.content || accumulated;
        model = event.model || model;
        usage = event.usage ?? usage;
      } else if (event.type === "error") {
        throw new Error(event.error || "TALA stream failed.");
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        consumeEvent(rawEvent);
        boundary = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode().replace(/\r\n/g, "\n");
    if (buffer.trim()) consumeEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  const content = (finalContent || accumulated).trim();
  if (!content) throw new Error("TALA returned an empty reply.");
  return { content, model, usage };
}

/** Single POST to the Cloudflare TallaAgent. Streams when onDelta is supplied. */
export async function talaChat(input: TalaChatInput): Promise<TalaChatResult> {
  const base = talaWorkerBase();
  const wantsStream = typeof input.onDelta === "function";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(wantsStream ? { Accept: "text/event-stream" } : {}),
  };
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
      stream: wantsStream,
    }),
    signal: input.signal,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || `TALA service error (HTTP ${res.status})`);
  }

  if (wantsStream && res.headers.get("Content-Type")?.includes("text/event-stream")) {
    return readTalaStream(res, input.onDelta!);
  }

  const data = (await res.json().catch(() => null)) as
    | { content?: string; error?: string; model?: string; usage?: unknown }
    | null;
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
