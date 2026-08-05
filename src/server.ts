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

type HermesAgentId = "supervisor" | "finance" | "leads" | "email" | "developer" | "operations";

const WORKFORCE_PROMPTS: Record<HermesAgentId, string> = {
  supervisor:
    "You are the Hermes Workforce Supervisor for this resort. Use the workforce-supervisor skill. Break work into clear tasks, use delegate_task when specialists can work in parallel, use verified resort tools, and never claim an action succeeded unless a tool returned success.",
  finance:
    "You are the resort Financial Agent. Use the resort-finance skill and live resort tools. Analyze revenue, expenses, occupancy, payroll, margin, and cash flow. Do not move money, change prices, refund, or alter records. Prepare recommendations and drafts for owner approval.",
  leads:
    "You are the resort Lead Generation Agent. Use the lead-generation skill. Review existing leads, research only approved public sources, qualify prospects, and prepare personalized follow-up. Do not send unsolicited outreach or expose guest information.",
  email:
    "You are the resort Email Agent. Use the email-operations skill. Classify communication and prepare concise, accurate replies using verified resort information. Draft only unless an approved email connection and explicit send approval are present.",
  developer:
    "You are the resort Developer Agent. Use the developer-agent skill. Inspect code, reproduce issues, work on a branch, run tests, and prepare a draft pull request. Never push to main, merge, deploy, delete data, or expose credentials.",
  operations:
    "You are the resort Operations Agent. Use the resort-operations skill and live resort tools. Coordinate bookings, tours, rentals, food, guest messages, staff tasks, and daily briefings. Protected changes require owner approval.",
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

function safeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index++) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function hasWorkforceAccess(request: Request, env: unknown): boolean {
  const expected = runtimeValue(env, "HERMES_WORKFORCE_ACCESS_KEY");
  const supplied = request.headers.get("x-hermes-workforce-key") || "";
  return Boolean(expected && supplied && safeEqual(expected, supplied));
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

async function hermesStatus(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
  if (!hasWorkforceAccess(request, env)) return json({ error: "Invalid workforce access key." }, 401);
  const url = runtimeValue(env, "HERMES_WORKFORCE_API_URL").replace(/\/$/, "");
  const key = runtimeValue(env, "HERMES_WORKFORCE_API_KEY");
  let hermes = false;
  if (url && key) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        headers: { authorization: `Bearer ${key}` },
      });
      hermes = response.ok;
    } catch {
      hermes = false;
    } finally {
      clearTimeout(timeout);
    }
  }
  return json({
    connections: {
      hermes,
      openrouter: hermes,
      supabase: Boolean(runtimeValue(env, "SUPABASE_URL") || runtimeValue(env, "VITE_SUPABASE_URL")),
      email: Boolean(runtimeValue(env, "RESEND_API_KEY") || runtimeValue(env, "GMAIL_CLIENT_ID")),
      github: Boolean(runtimeValue(env, "GITHUB_TOKEN")),
    },
  });
}

async function proxyWorkforceToHermes(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!hasWorkforceAccess(request, env)) return json({ error: "Invalid workforce access key." }, 401);
  const url = runtimeValue(env, "HERMES_WORKFORCE_API_URL").replace(/\/$/, "");
  const key = runtimeValue(env, "HERMES_WORKFORCE_API_KEY");
  const model = runtimeValue(env, "HERMES_WORKFORCE_MODEL") || "hermes-workforce";
  if (!url || !key) return json({ error: "Hermes Workforce is not configured." }, 503);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 200_000) return json({ error: "request too large" }, 413);
  let payload: { agent?: unknown; messages?: unknown };
  try {
    payload = (await request.json()) as { agent?: unknown; messages?: unknown };
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const agent = String(payload.agent || "") as HermesAgentId;
  if (!(agent in WORKFORCE_PROMPTS)) return json({ error: "unknown workforce agent" }, 400);
  const messages = normalizeMessages(payload.messages, 48);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return json({ error: "a user task is required" }, 400);
  }
  const requestedSession = request.headers.get("x-hermes-session") || "";
  const sessionKey = /^[a-zA-Z0-9._:-]{8,200}$/.test(requestedSession)
    ? `workforce:${agent}:${requestedSession}`
    : `workforce:${agent}:${crypto.randomUUID()}`;
  return callHermes({
    url,
    key,
    model,
    sessionKey,
    messages: [{ role: "system", content: WORKFORCE_PROMPTS[agent] }, ...messages],
  });
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
      if (new URL(request.url).pathname === "/api/hermes/status") {
        return await hermesStatus(request, env);
      }
      if (new URL(request.url).pathname === "/api/hermes/workforce") {
        return await proxyWorkforceToHermes(request, env);
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
