import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type TalaWireMessage = {
  role: "user" | "assistant";
  content: string;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function runtimeValue(env: unknown, name: string): string {
  const runtime = env && typeof env === "object" ? (env as Record<string, unknown>)[name] : undefined;
  if (typeof runtime === "string" && runtime) return runtime;
  return typeof process !== "undefined" ? process.env[name] ?? "" : "";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function proxyTalaToHermes(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const hermesUrl = runtimeValue(env, "HERMES_API_URL").replace(/\/$/, "");
  const hermesKey = runtimeValue(env, "HERMES_API_KEY");
  const model = runtimeValue(env, "HERMES_API_MODEL") || "tala";
  if (!hermesUrl || !hermesKey) {
    return json({ error: "TALA's Hermes service is not configured." }, 503);
  }

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 150_000) return json({ error: "request too large" }, 413);

  let payload: { messages?: unknown; model?: unknown };
  try {
    payload = (await request.json()) as { messages?: unknown; model?: unknown };
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  if (!Array.isArray(payload.messages)) return json({ error: "messages must be an array" }, 400);
  const messages: TalaWireMessage[] = payload.messages
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({ role: item.role as "user" | "assistant", content: String(item.content || "").slice(0, 8000) }))
    .filter((item) => item.content.trim())
    .slice(-32);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return json({ error: "a user message is required" }, 400);
  }

  const requestedSession = request.headers.get("x-tala-session") || "";
  const sessionKey = /^[a-zA-Z0-9._:-]{8,200}$/.test(requestedSession)
    ? requestedSession
    : `guest:${crypto.randomUUID()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${hermesUrl}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${hermesKey}`,
        "x-hermes-session-key": sessionKey,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string } | string;
      choices?: Array<{ message?: { content?: string | null } }>;
    } | null;
    if (!response.ok) {
      console.error("Hermes request failed", response.status, data?.error);
      return json({ error: "TALA is temporarily unavailable." }, 502);
    }
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: "TALA returned an empty reply." }, 502);
    return json({ reply, driver: "hermes", session: sessionKey });
  } catch (error) {
    console.error("Hermes connection failed", error);
    return json({ error: "TALA is temporarily unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (new URL(request.url).pathname === "/api/tala/chat") {
        return await proxyTalaToHermes(request, env);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
