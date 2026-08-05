// Hermes — private owner-only back-office workforce for the resort.
//
// TALA (supabase/functions/tala-chat) stays the public guest concierge and is
// untouched. Hermes is a separate, owner-authenticated runtime for heavy
// back-office work: Supervisor, Finance, Leads, Email, Developer, Operations.
//
// Secrets never leave this runtime:
//   OPENROUTER_API_KEY            (Edge Function secret)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injected by the runtime)
//   GITHUB_TOKEN / RESEND_API_KEY (optional; gate Developer writes + Email send)
//
// Every request requires a Supabase access token belonging to an owner/admin
// row in public.resort_members. verify_jwt is off because auth is enforced
// here (so we can return readable JSON errors instead of an opaque 401).
//
// Endpoints (path suffix after /functions/v1/hermes):
//   GET  /settings          provider + selected model + which secrets exist
//   PUT  /settings          save provider/model choice (non-secret only)
//   GET  /models            live OpenRouter catalog, free vs paid
//   POST /verify            live model test + live resort-data test
//   POST /run               run one agent against real resort data
//   GET  /handoffs          open TALA handoff tasks
//   POST /handoff           run the agent for one handoff task and store result
//   GET  /runs              recent Hermes runs

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const RESORT_ID = "marina_terrace";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const HANDOFF_PREFIX = "hermes";

const AGENT_IDS = ["supervisor", "finance", "leads", "email", "developer", "operations"] as const;
type AgentId = (typeof AGENT_IDS)[number];

const AGENT_PROMPTS: Record<AgentId, string> = {
  supervisor:
    "You are the Hermes Workforce Supervisor for this resort. Plan the work, break it into concrete owner-ready steps, and say which specialist (Finance, Leads, Email, Developer, Operations) should handle each one. Use only the resort data provided. Never claim an action was performed.",
  finance:
    "You are the resort Financial Agent. Analyse revenue, costs, occupancy, payroll and cash flow strictly from the resort data provided. Give numbers, then the three highest-value actions. Never move money, change prices or alter records. This is operational management analysis, not audited accounting advice.",
  leads:
    "You are the resort Lead Agent. Review the provided leads, rank them by likelihood to book, and draft the next follow-up for the top ones. Do not send outreach and do not expose other guests' information.",
  email:
    "You are the resort Email Agent. Triage the provided guest messages and prepare concise, accurate replies using only verified resort information. You draft only — sending is disabled until an email provider is connected and the owner approves.",
  developer:
    "You are the resort Developer Agent. Diagnose technical risks and describe precise, minimal fixes for the owner to approve. You have read-only insight: never push, merge, deploy or expose credentials.",
  operations:
    "You are the resort Operations Agent. Prepare the operations briefing from the provided data: arrivals, departures, tours, rentals, in-house guests, tasks and anything needing the owner today. Flag risks. Protected changes require owner approval.",
};

type Json = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    },
  });
}

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

function admin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireOwner(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { error: json({ error: "Sign in as the resort owner to use Hermes." }, 401) };

  const db = admin();
  const { data: userData, error: userError } = await db.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return { error: json({ error: "Your owner session has expired. Sign in again." }, 401) };
  }
  const { data: membership, error: memberError } = await db
    .from("resort_members")
    .select("role")
    .eq("resort_id", RESORT_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) {
    return { error: json({ error: `Unable to check resort access: ${memberError.message}` }, 500) };
  }
  if (!membership || !["owner", "admin"].includes(String(membership.role))) {
    return { error: json({ error: "This account is not an owner of this resort." }, 403) };
  }
  return { db, userId };
}

// --- settings ---------------------------------------------------------------

type Settings = {
  provider: string;
  openrouter_model: string;
  ollama_base_url: string;
  ollama_model: string;
  resort_cms_key: string;
  github_repository: string;
  resend_from_email: string;
};

const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  openrouter_model: "openai/gpt-oss-20b:free",
  ollama_base_url: "",
  ollama_model: "",
  resort_cms_key: "marina_terrace_payload",
  github_repository: "merqatodigital/set-sail-project",
  resend_from_email: "",
};

async function loadSettings(db: ReturnType<typeof admin>): Promise<Settings> {
  const { data } = await db.from("hermes_settings").select("*").eq("resort_id", RESORT_ID).maybeSingle();
  const row = (data ?? {}) as Json;
  return {
    provider: String(row.provider || DEFAULT_SETTINGS.provider),
    openrouter_model: String(row.openrouter_model || DEFAULT_SETTINGS.openrouter_model),
    ollama_base_url: String(row.ollama_base_url || ""),
    ollama_model: String(row.ollama_model || ""),
    resort_cms_key: String(row.resort_cms_key || DEFAULT_SETTINGS.resort_cms_key),
    github_repository: String(row.github_repository || DEFAULT_SETTINGS.github_repository),
    resend_from_email: String(row.resend_from_email || ""),
  };
}

function secretsPresent() {
  return {
    OPENROUTER_API_KEY: Boolean(env("OPENROUTER_API_KEY")),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env("SUPABASE_SERVICE_ROLE_KEY")),
    GITHUB_TOKEN: Boolean(env("GITHUB_TOKEN")),
    RESEND_API_KEY: Boolean(env("RESEND_API_KEY")),
  };
}

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

async function handleSettings(request: Request, db: ReturnType<typeof admin>): Promise<Response> {
  if (request.method === "GET") {
    return json({ settings: await loadSettings(db), secretsSet: secretsPresent() });
  }
  if (request.method !== "PUT") return json({ error: "method not allowed" }, 405);

  let body: Json;
  try {
    const payload = (await request.json()) as Json;
    body = (payload.settings && typeof payload.settings === "object" ? payload.settings : payload) as Json;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const provider = text(body.provider, 20) || "openrouter";
  if (provider !== "openrouter") {
    // Ollama stays a labelled future option; the local connector is not built yet.
    return json({ error: "The Local Machine (Ollama) connector is not available yet. Hermes runs on OpenRouter." }, 400);
  }
  const model = text(body.openrouter_model, 240);
  if (!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i.test(model)) {
    return json({ error: "Choose a valid OpenRouter model." }, 400);
  }

  const row = {
    resort_id: RESORT_ID,
    provider,
    openrouter_model: model,
    resort_cms_key: text(body.resort_cms_key, 240) || DEFAULT_SETTINGS.resort_cms_key,
    github_repository: text(body.github_repository, 240) || DEFAULT_SETTINGS.github_repository,
    resend_from_email: text(body.resend_from_email, 320),
  };
  const { error } = await db.from("hermes_settings").upsert(row, { onConflict: "resort_id" });
  if (error) return json({ error: `Unable to save Hermes settings: ${error.message}` }, 500);
  return json({ ok: true, settings: await loadSettings(db) });
}

// --- OpenRouter -------------------------------------------------------------

async function listModels(): Promise<Response> {
  try {
    const response = await fetch(`${OPENROUTER_URL}/models`, { headers: { accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.data)) {
      return json({ error: "OpenRouter model catalog is temporarily unavailable." }, 502);
    }
    const models = payload.data
      .map((item: Json) => {
        const pricing = (item.pricing && typeof item.pricing === "object" ? item.pricing : {}) as Json;
        const prompt = String(pricing.prompt ?? "0");
        const completion = String(pricing.completion ?? "0");
        const id = String(item.id || "");
        const supported = Array.isArray(item.supported_parameters) ? item.supported_parameters : [];
        return {
          id,
          name: String(item.name || id),
          free: (Number(prompt) === 0 && Number(completion) === 0) || id.endsWith(":free"),
          contextLength: Number(item.context_length || 0),
          promptPrice: prompt,
          completionPrice: completion,
          toolCalling: supported.includes("tools"),
        };
      })
      .filter((model: { id: string }) => model.id);
    return json({ models });
  } catch (error) {
    return json({ error: `OpenRouter model catalog failed: ${String(error)}` }, 502);
  }
}

async function completion(model: string, messages: Array<{ role: string; content: string }>) {
  const key = env("OPENROUTER_API_KEY");
  if (!key) return { error: "The OpenRouter key is missing from the Hermes backend secrets." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
      return { error: detail || `OpenRouter rejected the model (${response.status}).` };
    }
    const reply = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return { error: "The selected model returned an empty reply." };
    return { reply };
  } catch (error) {
    return { error: `OpenRouter could not be reached: ${String(error)}` };
  } finally {
    clearTimeout(timer);
  }
}

// --- resort data ------------------------------------------------------------

type ResortData = {
  cmsKey: string;
  siteName: string;
  rooms: unknown[];
  tours: unknown[];
  motorbikes: unknown[];
  bookings: unknown[];
  tourBookings: unknown[];
  rentals: unknown[];
  foodOrders: unknown[];
  payments: unknown[];
  payRecords: unknown[];
  staff: unknown[];
  guestMessages: unknown[];
  leads: unknown[];
  tasks: unknown[];
  briefings: unknown[];
};

async function loadResortData(db: ReturnType<typeof admin>, settings: Settings): Promise<ResortData> {
  const [{ data: cmsRow }, { data: leads }, { data: tasks }, { data: briefings }] = await Promise.all([
    db.from("cms_data").select("value").eq("key", settings.resort_cms_key).maybeSingle(),
    db.from("tala_leads").select("id,name,contact,note,source,source_url,created_at").order("created_at", { ascending: false }).limit(50),
    db.from("tala_tasks").select("id,title,due,status,category,created_at").order("created_at", { ascending: false }).limit(80),
    db.from("tala_briefings").select("brief_date,summary,highlights").order("generated_at", { ascending: false }).limit(3),
  ]);
  const cms = ((cmsRow as Json | null)?.value ?? {}) as Json;
  const ops = ((cms.operations ?? {}) as Json);
  const homepage = ((cms.homepage ?? {}) as Json);
  const settingsBlock = ((cms.settings ?? {}) as Json);
  const list = (value: unknown) => (Array.isArray(value) ? value.slice(0, 200) : []);
  return {
    cmsKey: settings.resort_cms_key,
    siteName: String(settingsBlock.siteName || "Marina Terrace"),
    rooms: list(homepage.rooms),
    tours: list(ops.tours),
    motorbikes: list(ops.motorbikes),
    bookings: list(ops.bookings),
    tourBookings: list(ops.tourBookings),
    rentals: list(ops.motorbikeRentals),
    foodOrders: list(ops.foodOrders),
    payments: list(ops.payments),
    payRecords: list(ops.payRecords),
    staff: list(ops.staff),
    guestMessages: list(ops.guestMessages),
    leads: list(leads),
    tasks: list(tasks),
    briefings: list(briefings),
  };
}

function dataCounts(data: ResortData) {
  return {
    rooms: data.rooms.length,
    tours: data.tours.length,
    motorbikes: data.motorbikes.length,
    bookings: data.bookings.length,
    tourBookings: data.tourBookings.length,
    rentals: data.rentals.length,
    foodOrders: data.foodOrders.length,
    payments: data.payments.length,
    payRecords: data.payRecords.length,
    staff: data.staff.length,
    guestMessages: data.guestMessages.length,
    leads: data.leads.length,
    tasks: data.tasks.length,
    briefings: data.briefings.length,
  };
}

function agentContext(agent: AgentId, data: ResortData): string {
  const shared = {
    resort: data.siteName,
    today: new Date().toISOString().slice(0, 10),
    rooms: data.rooms,
    tasks: data.tasks,
    latestBriefings: data.briefings,
  };
  const scoped: Json =
    agent === "finance"
      ? { bookings: data.bookings, tourBookings: data.tourBookings, rentals: data.rentals, foodOrders: data.foodOrders, payments: data.payments, payRecords: data.payRecords, staff: data.staff }
      : agent === "leads"
        ? { leads: data.leads, tours: data.tours, rooms: data.rooms }
        : agent === "email"
          ? { guestMessages: data.guestMessages, bookings: data.bookings, tours: data.tours }
          : agent === "developer"
            ? { repository: "resort website + admin + TALA concierge", tasks: data.tasks }
            : { bookings: data.bookings, tourBookings: data.tourBookings, rentals: data.rentals, motorbikes: data.motorbikes, foodOrders: data.foodOrders, guestMessages: data.guestMessages, staff: data.staff };
  return JSON.stringify({ ...shared, ...scoped }).slice(0, 90_000);
}

function capabilityNote(): string {
  const notes: string[] = [];
  if (!env("RESEND_API_KEY")) notes.push("Email sending is disabled (no email provider connected) — draft only.");
  if (!env("GITHUB_TOKEN")) notes.push("GitHub write access is disabled — describe changes, do not claim to have pushed.");
  return notes.length ? `Current limits: ${notes.join(" ")}` : "";
}

async function runAgent(
  db: ReturnType<typeof admin>,
  settings: Settings,
  agent: AgentId,
  task: string,
  history: Array<{ role: string; content: string }>,
) {
  const data = await loadResortData(db, settings);
  const note = capabilityNote();
  const messages = [
    { role: "system", content: `${AGENT_PROMPTS[agent]}${note ? `\n${note}` : ""}` },
    { role: "system", content: `Live resort data (JSON):\n${agentContext(agent, data)}` },
    ...history.slice(-12),
    { role: "user", content: task },
  ];
  const result = await completion(settings.openrouter_model, messages);
  return { result, counts: dataCounts(data) };
}

function normalizeHistory(value: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Json => Boolean(item) && typeof item === "object")
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({ role: String(item.role), content: String(item.content ?? "").slice(0, 8000) }))
    .filter((item) => item.content.trim());
}

function agentForCategory(category: string): AgentId {
  const value = category.toLowerCase();
  for (const id of AGENT_IDS) if (value.includes(id)) return id;
  if (value.includes("finance") || value.includes("payment")) return "finance";
  if (value.includes("lead")) return "leads";
  if (value.includes("mail") || value.includes("message")) return "email";
  return "operations";
}

// --- handlers ---------------------------------------------------------------

async function handleVerify(db: ReturnType<typeof admin>, settings: Settings): Promise<Response> {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  const keyPresent = Boolean(env("OPENROUTER_API_KEY"));
  const test = keyPresent
    ? await completion(settings.openrouter_model, [{ role: "user", content: "Reply with exactly OK." }])
    : { error: "The OpenRouter key is missing from the Hermes backend secrets." };
  const modelOk = "reply" in test;
  checks.openrouter = {
    ok: modelOk,
    detail: modelOk
      ? `${settings.openrouter_model} answered a live Hermes test.`
      : (test as { error: string }).error,
  };

  let counts: Record<string, number> | null = null;
  try {
    counts = dataCounts(await loadResortData(db, settings));
  } catch (error) {
    checks.supabase = { ok: false, detail: `Resort data read failed: ${String(error)}` };
  }
  if (counts) {
    const ok = counts.rooms + counts.bookings + counts.tours + counts.leads > 0;
    checks.supabase = {
      ok,
      detail: ok
        ? `Live resort data read: ${counts.rooms} rooms, ${counts.bookings} bookings, ${counts.tours} tours, ${counts.leads} leads, ${counts.tasks} tasks.`
        : "The resort data read returned nothing. Check the CMS key.",
    };
  }

  checks.hermes = {
    ok: modelOk && Boolean(checks.supabase?.ok),
    detail: modelOk && checks.supabase?.ok
      ? "Hermes agents can run against live resort data."
      : "Hermes needs both a working model and a live resort-data read.",
  };
  checks.email = {
    ok: Boolean(env("RESEND_API_KEY") && settings.resend_from_email),
    detail: env("RESEND_API_KEY")
      ? (settings.resend_from_email ? "Email provider connected." : "Add the from-address to enable Email Agent sending.")
      : "Optional: Email Agent drafts only until an email provider is connected.",
  };
  checks.github = {
    ok: Boolean(env("GITHUB_TOKEN") && settings.github_repository),
    detail: env("GITHUB_TOKEN")
      ? "GitHub developer connection available."
      : "Optional: Developer Agent is read-only until a GitHub token is added.",
  };
  checks.ollama = { ok: false, detail: "Local Machine Connector — coming soon. Not required for Hermes." };

  const ready = Boolean(checks.hermes.ok);
  return json({
    state: ready ? "ready" : "failed",
    ready,
    checks,
    counts,
    model: settings.openrouter_model,
    checkedAt: Date.now(),
  });
}

async function handleRun(request: Request, db: ReturnType<typeof admin>, userId: string, settings: Settings): Promise<Response> {
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const agent = String(body.agent ?? "") as AgentId;
  if (!AGENT_IDS.includes(agent)) return json({ error: "unknown Hermes agent" }, 400);
  const task = text(body.task, 8000);
  if (!task) return json({ error: "a task is required" }, 400);

  const { result, counts } = await runAgent(db, settings, agent, task, normalizeHistory(body.messages));
  if ("error" in result) return json({ error: result.error }, 502);

  await db.from("hermes_runs").insert({
    resort_id: RESORT_ID,
    agent,
    model: settings.openrouter_model,
    request: task,
    result: result.reply,
    created_by: userId,
  });
  return json({ reply: result.reply, agent, model: settings.openrouter_model, dataCounts: counts });
}

async function handleHandoffs(db: ReturnType<typeof admin>): Promise<Response> {
  const { data, error } = await db
    .from("tala_tasks")
    .select("id,title,due,status,category,created_at")
    .ilike("category", `%${HANDOFF_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return json({ error: `Unable to read TALA handoffs: ${error.message}` }, 500);
  const handoffs = (data ?? []).map((row: Json) => ({
    ...row,
    agent: agentForCategory(String(row.category ?? "")),
  }));
  return json({ handoffs });
}

async function handleHandoffRun(request: Request, db: ReturnType<typeof admin>, userId: string, settings: Settings): Promise<Response> {
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const taskId = text(body.taskId, 64);
  if (!taskId) return json({ error: "taskId is required" }, 400);

  const { data: task, error } = await db
    .from("tala_tasks")
    .select("id,title,category,status,due")
    .eq("id", taskId)
    .maybeSingle();
  if (error) return json({ error: `Unable to read that task: ${error.message}` }, 500);
  if (!task) return json({ error: "That TALA task no longer exists." }, 404);

  const agent = agentForCategory(String((task as Json).category ?? ""));
  const prompt = `TALA handed this back-office task to you: "${String((task as Json).title ?? "")}"${
    (task as Json).due ? ` (due ${String((task as Json).due)})` : ""
  }. Produce the finished back-office result the owner can act on.`;

  const { result, counts } = await runAgent(db, settings, agent, prompt, []);
  if ("error" in result) return json({ error: result.error }, 502);

  await db.from("hermes_runs").insert({
    resort_id: RESORT_ID,
    agent,
    model: settings.openrouter_model,
    request: prompt,
    result: result.reply,
    task_id: taskId,
    created_by: userId,
  });
  await db.from("tala_tasks").update({ status: "done" }).eq("id", taskId);

  return json({ reply: result.reply, agent, taskId, model: settings.openrouter_model, dataCounts: counts });
}

async function handleRuns(db: ReturnType<typeof admin>): Promise<Response> {
  const { data, error } = await db
    .from("hermes_runs")
    .select("id,agent,model,request,result,task_id,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return json({ error: `Unable to read Hermes runs: ${error.message}` }, 500);
  return json({ runs: data ?? [] });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return json({ ok: true });

  const path = new URL(request.url).pathname.replace(/^.*\/hermes/, "").replace(/\/+$/, "") || "/";

  if (path === "/models" && request.method === "GET") {
    const owner = await requireOwner(request);
    if ("error" in owner) return owner.error;
    return listModels();
  }

  const owner = await requireOwner(request);
  if ("error" in owner) return owner.error;
  const { db, userId } = owner;

  try {
    if (path === "/settings") return await handleSettings(request, db);

    const settings = await loadSettings(db);
    if (path === "/verify" && request.method === "POST") return await handleVerify(db, settings);
    if (path === "/run" && request.method === "POST") return await handleRun(request, db, userId, settings);
    if (path === "/handoffs" && request.method === "GET") return await handleHandoffs(db);
    if (path === "/handoff" && request.method === "POST") return await handleHandoffRun(request, db, userId, settings);
    if (path === "/runs" && request.method === "GET") return await handleRuns(db);
    if (path === "/" && request.method === "GET") {
      return json({ ok: true, service: "hermes", endpoints: ["/settings", "/models", "/verify", "/run", "/handoffs", "/handoff", "/runs"] });
    }
    return json({ error: `Unknown Hermes endpoint: ${path}` }, 404);
  } catch (error) {
    console.error("Hermes failure", error);
    return json({ error: `Hermes failed: ${String(error)}` }, 500);
  }
});
