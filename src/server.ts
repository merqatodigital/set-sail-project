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

const HERMES_RESORT_ID = "marina_terrace";

type HermesBrowserSettings = {
  AI_PROVIDER?: unknown;
  OPENROUTER_API_KEY?: unknown;
  HERMES_MODEL?: unknown;
  OLLAMA_BASE_URL?: unknown;
  OLLAMA_MODEL?: unknown;
  SUPABASE_URL?: unknown;
  SUPABASE_SERVICE_ROLE_KEY?: unknown;
  RESORT_CMS_KEY?: unknown;
  TALA_GITHUB_REPOSITORY?: unknown;
  GITHUB_TOKEN?: unknown;
  RESEND_API_KEY?: unknown;
  RESEND_FROM_EMAIL?: unknown;
};

function settingText(value: unknown, limit = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

async function requireHermesOwner(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: json({ error: "Sign in as the resort owner to manage Hermes." }, 401) } as const;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: userResult, error: userError } = await db.auth.getUser(token);
    const userId = userResult?.user?.id as string | undefined;
    if (userError || !userId) return { error: json({ error: "Your owner session has expired. Sign in again." }, 401) } as const;

    const { data: membership, error: membershipError } = await db
      .from("resort_members")
      .select("role")
      .eq("resort_id", HERMES_RESORT_ID)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return { error: json({ error: "This account is not an owner of this resort." }, 403) } as const;
    }
    return { db, userId } as const;
  } catch (error) {
    console.error("Hermes owner authentication failed", error);
    return { error: json({ error: "Hermes settings database is not connected yet." }, 503) } as const;
  }
}

function publicSettings(row: Record<string, unknown> | null) {
  return {
    AI_PROVIDER: String(row?.provider || "openrouter"),
    HERMES_MODEL: String(row?.openrouter_model || "openai/gpt-oss-20b"),
    OLLAMA_BASE_URL: String(row?.ollama_base_url || "http://host.docker.internal:11434/v1"),
    OLLAMA_MODEL: String(row?.ollama_model || ""),
    SUPABASE_URL: String(row?.supabase_url || ""),
    RESORT_CMS_KEY: String(row?.resort_cms_key || "marina_terrace_payload"),
    TALA_GITHUB_REPOSITORY: String(row?.github_repository || "merqatodigital/set-sail-project"),
    RESEND_FROM_EMAIL: String(row?.resend_from_email || ""),
  };
}

async function hermesSettings(request: Request): Promise<Response> {
  const owner = await requireHermesOwner(request);
  if ("error" in owner) return owner.error;
  const { db } = owner;

  if (request.method === "GET") {
    const [{ data: settings, error: settingsError }, { data: secretStatus, error: secretsError }] = await Promise.all([
      db.from("hermes_settings").select("*").eq("resort_id", HERMES_RESORT_ID).maybeSingle(),
      db.rpc("hermes_secret_status", { p_resort_id: HERMES_RESORT_ID }),
    ]);
    if (settingsError || secretsError) {
      console.error("Unable to read Hermes settings", settingsError || secretsError);
      return json({ error: "Unable to load Hermes settings." }, 500);
    }
    const secretRow = (Array.isArray(secretStatus) ? secretStatus[0] : secretStatus || {}) as Record<string, unknown>;
    return json({
      settings: publicSettings(settings as Record<string, unknown> | null),
      secretsSet: {
        OPENROUTER_API_KEY: Boolean(secretRow.openrouter_key_saved),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(secretRow.supabase_key_saved),
        GITHUB_TOKEN: Boolean(secretRow.github_token_saved),
        RESEND_API_KEY: Boolean(secretRow.resend_key_saved),
      },
    });
  }

  if (request.method !== "PUT") return json({ error: "method not allowed" }, 405);
  let body: HermesBrowserSettings;
  try {
    const payload = (await request.json()) as HermesBrowserSettings & { settings?: HermesBrowserSettings };
    body = payload.settings && typeof payload.settings === "object" ? payload.settings : payload;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const aiProvider = settingText(body.AI_PROVIDER, 20);
  if (aiProvider !== "openrouter" && aiProvider !== "ollama") return json({ error: "Choose OpenRouter or Ollama." }, 400);
  const settingsRow = {
    resort_id: HERMES_RESORT_ID,
    provider: aiProvider,
    openrouter_model: settingText(body.HERMES_MODEL, 240),
    ollama_base_url: settingText(body.OLLAMA_BASE_URL, 1024),
    ollama_model: settingText(body.OLLAMA_MODEL, 240),
    supabase_url: settingText(body.SUPABASE_URL, 1024),
    resort_cms_key: settingText(body.RESORT_CMS_KEY, 240),
    github_repository: settingText(body.TALA_GITHUB_REPOSITORY, 240),
    resend_from_email: settingText(body.RESEND_FROM_EMAIL, 320),
  };
  const secretValues = {
    openrouter_api_key: settingText(body.OPENROUTER_API_KEY, 4096),
    supabase_service_role_key: settingText(body.SUPABASE_SERVICE_ROLE_KEY, 8192),
    github_token: settingText(body.GITHUB_TOKEN, 4096),
    resend_api_key: settingText(body.RESEND_API_KEY, 4096),
  };

  const { error: settingsError } = await db.from("hermes_settings").upsert(settingsRow, { onConflict: "resort_id" });
  if (settingsError) {
    console.error("Unable to save Hermes settings", settingsError);
    return json({ error: "Unable to save Hermes settings." }, 500);
  }
  const changedSecrets = Object.fromEntries(Object.entries(secretValues).filter(([, value]) => value));
  if (Object.keys(changedSecrets).length) {
    const { error: secretsError } = await db.rpc("save_hermes_secrets", {
      p_resort_id: HERMES_RESORT_ID,
      p_runtime_access_key: null,
      p_openrouter_api_key: secretValues.openrouter_api_key || null,
      p_supabase_service_role_key: secretValues.supabase_service_role_key || null,
      p_github_token: secretValues.github_token || null,
      p_resend_api_key: secretValues.resend_api_key || null,
    });
    if (secretsError) {
      console.error("Unable to save Hermes secrets", secretsError);
      return json({ error: "Settings saved, but the private keys could not be saved." }, 500);
    }
  }
  return json({ ok: true });
}

type HermesRuntimeConfig = {
  provider: string;
  openrouter_model: string;
  ollama_base_url: string;
  ollama_model: string;
  supabase_url: string;
  github_repository: string;
  resend_from_email: string;
  openrouter_api_key: string;
  supabase_service_role_key: string;
  github_token: string;
  resend_api_key: string;
};

async function runtimeConfig(db: any): Promise<{ config: HermesRuntimeConfig } | { error: Response }> {
  const { data, error } = await db.rpc("hermes_runtime_config", { p_resort_id: HERMES_RESORT_ID });
  const config = (Array.isArray(data) ? data[0] : data) as HermesRuntimeConfig | null;
  if (error || !config) {
    console.error("Unable to read Hermes runtime configuration", error);
    return { error: json({ error: "Hermes secure runtime bridge is not installed yet." }, 503) };
  }
  // The connected Supabase project is the trusted default. The owner does not
  // need to copy the same project URL or service key into the Hermes form.
  return {
    config: {
      ...config,
      supabase_url: config.supabase_url || runtimeValue(undefined, "SUPABASE_URL"),
      supabase_service_role_key: config.supabase_service_role_key || runtimeValue(undefined, "SUPABASE_SERVICE_ROLE_KEY"),
    },
  };
}

function providerChecks(config: HermesRuntimeConfig, liveModel = false) {
  const openrouter = config.provider === "openrouter" && Boolean(config.openrouter_api_key && config.openrouter_model);
  const ollama = config.provider === "ollama" && Boolean(config.ollama_base_url && config.ollama_model);
  const modelReady = liveModel && (openrouter || ollama);
  return {
    hermes: modelReady,
    openrouter: openrouter || ollama,
    supabase: Boolean(config.supabase_url && config.supabase_service_role_key),
    email: Boolean(config.resend_from_email && config.resend_api_key),
    github: Boolean(config.github_repository && config.github_token),
  };
}

async function callOpenRouter(config: HermesRuntimeConfig, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<Response> {
  if (config.provider !== "openrouter") {
    return json({ error: "Ollama needs the local Hermes connector. Select OpenRouter to run Hermes from this site now." }, 503);
  }
  if (!config.openrouter_api_key || !config.openrouter_model) {
    return json({ error: "Add an OpenRouter API key and model in Hermes Setup first." }, 400);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openrouter_api_key}`,
      },
      body: JSON.stringify({ model: config.openrouter_model, messages, stream: false }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
      console.error("OpenRouter Hermes request failed", response.status, reason);
      return json({ error: reason || "OpenRouter rejected the selected model." }, 502);
    }
    return json(payload);
  } catch (error) {
    console.error("OpenRouter Hermes connection failed", error);
    return json({ error: "OpenRouter could not be reached from Hermes." }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function hermesRuntimeStatus(request: Request, liveTest = false): Promise<Response> {
  if (request.method !== (liveTest ? "POST" : "GET")) return json({ error: "method not allowed" }, 405);
  const owner = await requireHermesOwner(request);
  if ("error" in owner) return owner.error;
  const loaded = await runtimeConfig(owner.db);
  if ("error" in loaded) return loaded.error;
  const { config } = loaded;
  let connections = providerChecks(config, false);
  let modelDetail = config.provider === "ollama"
    ? (connections.openrouter ? "Ollama machine and model saved." : "Ollama machine URL or model is missing.")
    : (connections.openrouter ? "OpenRouter key and model saved." : "OpenRouter key or model is missing.");
  if (liveTest && config.provider === "openrouter") {
    const test = await callOpenRouter(config, [{ role: "user", content: "Reply with exactly OK." }]);
    if (test.ok) {
      connections = providerChecks(config, true);
      modelDetail = "Selected OpenRouter model answered a live Hermes test.";
    } else {
      const payload = await test.json().catch(() => null) as { error?: string } | null;
      modelDetail = payload?.error || "The selected OpenRouter model did not pass the live test.";
    }
  }
  const checks = {
    hermes: { ok: connections.hermes, detail: connections.hermes ? "Hermes is responding through TALA." : modelDetail },
    openrouter: { ok: connections.openrouter, detail: modelDetail },
    supabase: { ok: connections.supabase, detail: connections.supabase ? "Private resort-data connection saved." : "Add the Supabase project URL and service key." },
    email: { ok: connections.email, detail: connections.email ? "Resend email connection saved." : "Resend is optional until Email Agent sending is enabled." },
    github: { ok: connections.github, detail: connections.github ? "GitHub developer connection saved." : "GitHub is optional until Developer Agent work is enabled." },
  };
  const ready = connections.hermes && connections.openrouter && connections.supabase;
  return json({
    configured: Boolean(connections.openrouter || connections.supabase),
    connections,
    verification: { state: ready ? "ready" : "failed", ready, checks, checkedAt: Date.now() },
  });
}

async function hermesWorkforce(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const owner = await requireHermesOwner(request);
  if ("error" in owner) return owner.error;
  const loaded = await runtimeConfig(owner.db);
  if ("error" in loaded) return loaded.error;
  let payload: { agent?: unknown; messages?: unknown };
  try {
    payload = await request.json() as { agent?: unknown; messages?: unknown };
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const agent = String(payload.agent || "") as HermesAgentId;
  if (!(agent in WORKFORCE_PROMPTS)) return json({ error: "unknown workforce agent" }, 400);
  const messages = normalizeMessages(payload.messages, 48);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return json({ error: "a user task is required" }, 400);
  }
  return callOpenRouter(loaded.config, [{ role: "system", content: WORKFORCE_PROMPTS[agent] }, ...messages]);
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
      if (new URL(request.url).pathname === "/api/hermes/settings") {
        return await hermesSettings(request);
      }
      if (new URL(request.url).pathname === "/api/hermes/status") {
        return await hermesRuntimeStatus(request);
      }
      if (new URL(request.url).pathname === "/api/hermes/verify") {
        return await hermesRuntimeStatus(request, true);
      }
      if (new URL(request.url).pathname === "/api/hermes/workforce") {
        return await hermesWorkforce(request);
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
