// ---------------------------------------------------------------------------
// tallaCloud.ts — frontend client for the PROVEN Cloudflare TALA backend.
//
// This is the ONLY place the browser talks to the staging Worker. It wraps
// the real endpoints we verified end-to-end:
//   GET  /api/health                         -> worker + capability state
//   POST /api/talla/chat                     -> TallaAgent (LLM + tools)
//   GET  /api/workflows/daily-briefing/artifacts -> latest Workflow briefing
//   POST /api/workflows/daily-briefing       -> trigger DailyResortBriefingWorkflow
//
// Owner-facing result. No Cloudflare engineering jargon leaks past this file.
// Supabase-backed flows (useTalaChat, talaOps) are untouched — this is additive.
// ---------------------------------------------------------------------------

import { talaChat, talaOwnerToken, talaOwnerUserId, talaWorkerBase, TALA_TENANT } from "./talaClient";

/** Default resort tenant used by the backend. */
export const TALLA_TENANT = TALA_TENANT;

export interface TallaBackendHealth {
  service: string;
  status: string;
  capabilities: {
    agent: boolean;
    d1: boolean;
    computer: "enabled" | "disabled";
    workflows: boolean;
  };
  debug?: {
    tallaComputerEnabled?: string | null;
    [key: string]: unknown;
  };
}

export interface TallaBriefingArtifact {
  date: string;
  relativePath: string;
  type: string;
  contentLength: number;
  createdAt: string;
  content?: string;
  contentPreview: string;
}

export interface TallaChatResult {
  content: string | null;
  model?: string;
  usage?: unknown;
}

/** Raw health payload from the Worker. */
export async function fetchTallaHealth(signal?: AbortSignal): Promise<TallaBackendHealth> {
  const res = await fetch(`${talaWorkerBase()}/api/health`, { signal });
  if (!res.ok) throw new Error(`TALA backend returned ${res.status}`);
  return (await res.json()) as TallaBackendHealth;
}

/** Latest DailyResortBriefingWorkflow artifact (D1-backed, reliable). */
export async function fetchLatestBriefing(
  tenantId: string = TALLA_TENANT,
  signal?: AbortSignal,
): Promise<{ artifacts: TallaBriefingArtifact[] }> {
  const res = await fetch(
    `${talaWorkerBase()}/api/workflows/daily-briefing/artifacts?tenant=${encodeURIComponent(tenantId)}&full=1`,
    { headers: { "X-Dev-Tenant": tenantId }, signal },
  );
  if (!res.ok) throw new Error(`Briefing fetch returned ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    data?: { artifacts: TallaBriefingArtifact[] };
  };
  return { artifacts: body.data?.artifacts ?? [] };
}

/** Trigger the existing DailyResortBriefingWorkflow (idempotent per date). */
export async function triggerBriefing(
  tenantId: string = TALLA_TENANT,
  signal?: AbortSignal,
): Promise<{ instanceId: string; date: string }> {
  const res = await fetch(`${talaWorkerBase()}/api/workflows/daily-briefing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Dev-Tenant": tenantId },
    body: JSON.stringify({}),
    signal,
  });
  if (!res.ok) throw new Error(`Briefing trigger returned ${res.status}`);
  const body = (await res.json()) as {
    success: boolean;
    data?: { instanceId: string; date: string };
  };
  if (!body.success || !body.data) throw new Error("Briefing trigger failed");
  return { instanceId: body.data.instanceId, date: body.data.date };
}

/**
 * Ask the SAME proven TallaAgent behind the Admin. This is the agentic
 * TALA we verified: LLM reasoning -> tool selection -> D1/Computer -> reply.
 * No separate chatbot backend.
 */
export async function askTalla(
  message: string,
  opts: { tenantId?: string; role?: string; userId?: string } = {},
  signal?: AbortSignal,
): Promise<TallaChatResult> {
  // Owner authorization is decided by the Worker from this bearer token —
  // the `role` field is context only.
  const [authToken, ownerId] = await Promise.all([talaOwnerToken(), talaOwnerUserId()]);
  return talaChat({
    message,
    tenantId: opts.tenantId ?? TALLA_TENANT,
    role: (opts.role as "guest" | "owner") ?? "owner",
    userId: opts.userId ?? ownerId ?? "owner-session",
    authToken: authToken || undefined,
    signal,
  });
}

export interface TallaStatusView {
  /** Human label for the primary strip. */
  label: string;
  /** owner-facing state for each pillar. */
  tala: "online" | "offline" | "unknown";
  computer: "ready" | "off" | "unknown";
  automation: "running" | "off" | "unknown";
  model: "connected" | "off" | "unknown";
  /** true when we successfully reached the backend. */
  reachable: boolean;
  /** optional detail for a diagnostics surface. */
  detail?: string;
}

/** Translate raw health into simple owner-facing status. */
export function toStatusView(health: TallaBackendHealth): TallaStatusView {
  const caps = health.capabilities;
  return {
    label: "TALA — Resort OS",
    tala: caps.agent ? "online" : "offline",
    computer: caps.computer === "enabled" ? "ready" : "off",
    automation: caps.workflows ? "running" : "off",
    model: caps.d1 ? "connected" : "off",
    reachable: true,
    detail: `worker: ${health.status}`,
  };
}
