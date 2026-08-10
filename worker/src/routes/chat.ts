// Chat endpoint — bridges HTTP requests to the TallaAgent Durable Object.
// This is the entry point for the existing TalaWidget when feature flag is enabled.

import type { Env } from "../env.js";
import { resolveAuth } from "../auth/middleware.js";

export async function handleTallaChat(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = (await request.json()) as {
      message?: string;
      tenantId?: string;
      userId?: string;
      role?: string;
      guestName?: string;
      guestRoom?: string;
    };

    if (!body.message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Resolve tenant from auth or use provided tenantId
    let tenantId = body.tenantId || "";
    let userId = body.userId || null;
    let role = body.role || null;

    // Try to resolve from auth header
    const auth = await resolveAuth(request, env);
    const isOwner = auth.authenticated && (auth.role === "owner" || auth.role === "admin");
    if (isOwner) {
      tenantId = auth.tenantId ?? tenantId;
      userId = auth.userId;
      role = auth.role;
    }

    if (!tenantId) {
      return Response.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Durable Object isolation:
    // - Owner/admin share one conversation per tenant (current behavior).
    // - Public guests are isolated per session (tenantId:userId) so two
    //   visitors never share conversation history / private context.
    const doKey = isOwner ? tenantId : `${tenantId}:${userId || "anon"}`;
    const doId = env.TALLA_AGENT.idFromName(doKey);
    const stub = env.TALLA_AGENT.get(doId);

    // Send the chat message via HTTP
    const chatResponse = await stub.fetch(
      new Request("https://talla-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: body.message,
          tenantId,
          userId,
          role,
          guestName: body.guestName,
          guestRoom: body.guestRoom,
        }),
      }),
    );

    const result = (await chatResponse.json()) as {
      content?: string;
      error?: string;
      model?: string;
      usage?: unknown;
    };

    return Response.json({
      content:
        result.content && result.content.trim().length > 0
          ? result.content
          : "I'm sorry, I didn't catch that. Could you say that again?",
      model: result.model,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[talla-chat] Error:", err);
    return Response.json({ error: "Failed to process message" }, { status: 500 });
  }
}
