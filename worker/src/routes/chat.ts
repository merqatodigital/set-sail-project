// Chat endpoint — bridges HTTP requests to the TallaAgent Durable Object.
// This is the entry point for the existing TalaWidget when feature flag is enabled.
//
// SECURITY: the browser `role` field is NEVER trusted. Effective role comes
// ONLY from server-side resolveAuth(). A forged body.role:"owner" is routed as
// a guest and isolated to its own tenantId:userId Durable Object.

import type { Env } from "../env.js";
import { resolveAuth } from "../auth/middleware.js";
import { resolveChatIdentity } from "../agents/turnRouter.js";

export async function handleTallaChat(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const tAuthStart = Date.now();

  try {
    const body = (await request.json()) as {
      message?: string;
      tenantId?: string;
      userId?: string;
      role?: string;
      guestName?: string;
      guestRoom?: string;
      stream?: boolean;
    };

    if (!body.message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Resolve trusted identity — body.role is intentionally ignored here.
    const auth = await resolveAuth(request, env);
    const identity = resolveChatIdentity(auth, body);
    const authMs = Date.now() - tAuthStart;

    if (!identity.tenantId) {
      return Response.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Determine streaming intent: explicit body.stream OR Accept: text/event-stream.
    const wantsStream =
      body.stream === true ||
      request.headers.get("Accept") === "text/event-stream";

    // Durable Object dispatch. Owner/admin share one DO per tenant; guests are
    // isolated per tenantId:userId so two visitors never share context.
    const doId = env.TALLA_AGENT.idFromName(identity.doKey);
    const stub = env.TALLA_AGENT.get(doId);

    const doRequest = new Request("https://talla-agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Trusted identity forwarded to the DO via headers (never body.role).
        "X-Tenant-Id": identity.tenantId,
        "X-User-Role": identity.role,
        ...(identity.userId ? { "X-User-Id": identity.userId } : {}),
        ...(wantsStream ? { "X-Stream": "1", Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify({
        content: body.message,
        tenantId: identity.tenantId,
        userId: identity.userId,
        guestName: body.guestName,
        guestRoom: body.guestRoom,
      }),
      // Propagate client abort so a new utterance cancels in-flight work.
      signal: request.signal,
    });

    const tDoStart = Date.now();
    const chatResponse = await stub.fetch(doRequest);
    const doMs = Date.now() - tDoStart;

    // Streaming path: forward the SSE response verbatim (CORS already applied
    // by index.ts wrapper, but add them here for directness).
    if (wantsStream && chatResponse.headers.get("Content-Type")?.includes("text/event-stream")) {
      const headers = new Headers(chatResponse.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "no-cache, no-transform");
      headers.set("Connection", "keep-alive");
      return new Response(chatResponse.body, { status: 200, headers });
    }

    const result = (await chatResponse.json()) as {
      content?: string;
      error?: string;
      model?: string;
      usage?: unknown;
      timing?: Record<string, unknown>;
    };

    // Merge server-side timing (auth + DO dispatch) with the DO's own timing.
    const doTiming = (result.timing ?? {}) as Record<string, number>;
    const timing = {
      ...doTiming,
      authMs,
      doMs,
      totalMs: (doTiming.totalMs ?? 0) + authMs + doMs,
    };

    return Response.json({
      content:
        result.content && result.content.trim().length > 0
          ? result.content
          : "I'm sorry, I didn't catch that. Could you say that again?",
      model: result.model,
      usage: result.usage,
      role: identity.role,
      timing,
    });
  } catch (err) {
    console.error("[talla-chat] Error:", err);
    // Distinguish abort from real failure so the client can ignore stale ones.
    if ((err as Error).name === "AbortError") {
      return Response.json({ error: "aborted", aborted: true }, { status: 499 });
    }
    return Response.json({ error: "Failed to process message" }, { status: 500 });
  }
}
