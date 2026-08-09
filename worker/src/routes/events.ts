// Event ingestion route — verified webhooks that wake the existing TallaAgent.
//
// Supported endpoints (typed by path):
//   POST /api/events/booking
//   POST /api/events/payment
//   POST /api/events/guest-request
//
// Flow: verify HMAC signature -> parse+payload validation -> persist (dedup)
//   -> forward to the tenant's TallaAgent DO -> return 202 Accepted.
//
// Security:
//  - Missing/invalid signature => 401 (never processed).
//  - Wrong tenant (not marina_terrace) => 403 (no cross-tenant exposure).
//  - Duplicate event id => 200, no downstream action.
//  - tenant/role are NEVER taken from the payload for authorization; the
//    webhook is trusted only because its signature verifies against the
//    server-held secret.

import type { Env } from "../env.js";

const KNOWN_TENANT = "marina_terrace";

const PATH_TO_TYPE: Record<string, string> = {
  "/api/events/booking": "booking.created",
  "/api/events/payment": "payment.recorded",
  "/api/events/guest-request": "guest_request.created",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function handleEvents(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  const eventType = PATH_TO_TYPE[path];
  if (!eventType) {
    return Response.json({ error: "Unsupported event endpoint" }, { status: 404 });
  }

  const secret = env.WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook signing secret not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const sigHeader = request.headers.get("X-Webhook-Signature");

  // HMAC-SHA256 verification (timing-safe)
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let provided = "";
  if (sigHeader) {
    const eq = sigHeader.split("=");
    if (eq[0] === "sha256") provided = eq[1] ?? "";
  }
  if (!sigHeader || !timingSafeEqual(provided, computedHex)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse + validate payload
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Malformed payload" }, { status: 400 });
  }
  const p = payload as {
    eventId?: string;
    tenantId?: string;
    recordId?: string;
    occurredAt?: string;
    payload?: unknown;
  };
  if (!p.eventId || !p.tenantId) {
    return Response.json({ error: "Missing eventId or tenantId" }, { status: 400 });
  }

  // Tenant isolation: only the wired tenant is accepted. Wrong tenant is
  // rejected (never exposed cross-tenant).
  if (p.tenantId !== KNOWN_TENANT) {
    return Response.json({ error: "Tenant not allowed" }, { status: 403 });
  }

  // Persist + dedup
  const { recordEvent, markEventProcessed } = await import("../db/repos/eventLogRepo.js");
  const { duplicate } = await recordEvent(env.DB, {
    eventId: p.eventId,
    eventType,
    tenantId: p.tenantId,
    recordId: p.recordId ?? null,
    payload: p.payload ?? payload,
  });

  if (duplicate) {
    return Response.json({ accepted: true, duplicate: true }, { status: 200 });
  }

  // Forward to the existing TallaAgent DO (same instance per tenant).
  try {
    const doId = env.TALLA_AGENT.idFromName(p.tenantId);
    const stub = env.TALLA_AGENT.get(doId);
    const doResponse = await stub.fetch(
      new Request("https://talla-agent/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          eventId: p.eventId,
          tenantId: p.tenantId,
          recordId: p.recordId ?? null,
          occurredAt: p.occurredAt ?? null,
          payload: p.payload ?? payload,
        }),
      }),
    );
    const doBody = await doResponse.text().catch(() => "");
    await markEventProcessed(
      env.DB,
      p.eventId,
      doResponse.ok ? "processed" : "error",
      doBody.slice(0, 2000),
    );
    // Return fast accept regardless of downstream outcome.
    return Response.json(
      { accepted: true, duplicate: false, eventId: p.eventId, eventType },
      { status: 202 },
    );
  } catch (err) {
    await markEventProcessed(env.DB, p.eventId, "error", (err as Error).message);
    return Response.json({ accepted: true, error: (err as Error).message }, { status: 202 });
  }
}
