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

async function callHermes(options: {
  url: string;
  key: string;
  model: string;
  sessionKey: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${options.url}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.key}`,
        "x-hermes-session-key": options.sessionKey,
      },
      body: JSON.stringify({ model: options.model, messages: options.messages, stream: false }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string } | string;
      choices?: Array<{ message?: { content?: string | null } }>;
    } | null;
    if (!response.ok) {
      console.error("Hermes request failed", response.status, data?.error);
      return json({ error: "Hermes is temporarily unavailable." }, 502);
    }
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: "Hermes returned an empty reply." }, 502);
    return json({ reply, driver: "hermes", session: options.sessionKey });
  } catch (error) {
    console.error("Hermes connection failed", error);
    return json({ error: "Hermes is temporarily unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMessages(value: unknown, limit = 32): TalaWireMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: String(item.content || "").slice(0, 12_000),
    }))
    .filter((item) => item.content.trim())
    .slice(-limit);
}

async function proxyTalaToHermes(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const hermesUrl = (runtimeValue(env, "HERMES_TALA_API_URL") || runtimeValue(env, "HERMES_API_URL")).replace(/\/$/, "");
  const hermesKey = runtimeValue(env, "HERMES_TALA_API_KEY") || runtimeValue(env, "HERMES_API_KEY");
  const model = runtimeValue(env, "HERMES_TALA_MODEL") || "tala";
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

  const messages = normalizeMessages(payload.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return json({ error: "a user message is required" }, 400);
  }

  const requestedSession = request.headers.get("x-tala-session") || "";
  const sessionKey = /^[a-zA-Z0-9._:-]{8,200}$/.test(requestedSession)
    ? requestedSession
    : `guest:${crypto.randomUUID()}`;

  return callHermes({ url: hermesUrl, key: hermesKey, model, sessionKey, messages });
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

async function openRouterModels(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return json({ error: "OpenRouter model catalog is temporarily unavailable." }, 502);
    return new Response(await response.text(), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("OpenRouter model catalog failed", error);
    return json({ error: "OpenRouter model catalog is temporarily unavailable." }, 502);
  }
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
      if (new URL(request.url).pathname === "/api/openrouter/models") {
        return await openRouterModels(request);
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
