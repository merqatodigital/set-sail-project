// Cloudflare Worker — Talla Agent + Resort API
//
// Architecture:
//   Browser → Worker fetch → Auth bridge → Tenant guard → D1 → Response
//   Browser → WebSocket → TallaAgent Durable Object → OpenRouter + D1
//
// Phase 5: TallaAgent is now the real resort agent with LLM reasoning,
// D1-backed tools, and proper authorization.

import { routeAgentRequest } from "agents";
import { resolveAuth } from "./auth/middleware.js";
import { handleTours } from "./routes/tours.js";
import { handleGuestRequests } from "./routes/requests.js";
import { handlePropertySettings } from "./routes/settings.js";
import { handleHousekeeping } from "./routes/housekeeping.js";
import { handleMaintenance } from "./routes/maintenance.js";
import { handleMenu } from "./routes/menu.js";
import { handleInventory } from "./routes/inventory.js";
import { handleTallaOps } from "./routes/tallaOps.js";
import { handleTallaChat } from "./routes/chat.js";
import { handleWorkflows } from "./routes/workflows.js";
import { handleComputer } from "./routes/computer.js";
import type { Env } from "./env.js";

// Re-export TallaAgent for wrangler discovery
export { TallaAgent } from "./agents/TallaAgent.js";

// Re-export Workflow for wrangler discovery
export { DailyResortBriefingWorkflow } from "./workflows/DailyResortBriefingWorkflow.js";

// ---- Worker fetch handler ----

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route agent requests (WebSocket + HTTP) to the Durable Object
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      console.log(`[index] routeAgentRequest intercepted: ${path}`);
      return agentResponse;
    }
    console.log(`[index] routeAgentRequest passed through: ${path}`);

    // CORS headers for all API responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check (no auth needed)
    if (path === "/" || path === "/api/health") {
      return Response.json({
        service: "talla-worker",
        status: "running",
        timestamp: new Date().toISOString(),
        capabilities: {
          agent: true,
          d1: true,
          computer: env.TALLA_COMPUTER_ENABLED === "true" ? "enabled" : "disabled",
          workflows: true,
        },
        debug: {
          tallaComputerEnabled: env.TALLA_COMPUTER_ENABLED,
          supabaseUrl: env.SUPABASE_URL ? "set" : "not set",
        },
      }, { headers: corsHeaders });
    }

    // Debug: test if requests reach the fetch handler
    if (path === "/api/debug/routes") {
      return Response.json({
        path,
        method: request.method,
        hasAuth: !!request.headers.get("Authorization"),
        hasDevTenant: !!request.headers.get("X-Dev-Tenant"),
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders });
    }

    // Resolve authentication (applied to all API routes)
    const auth = await resolveAuth(request, env);

    // Route API requests
    let response: Response;

    if (path.startsWith("/api/tours")) {
      response = await handleTours(request, env, auth, path);
    } else if (path.startsWith("/api/requests")) {
      response = await handleGuestRequests(request, env, auth, path);
    } else if (path.startsWith("/api/settings")) {
      response = await handlePropertySettings(request, env, auth, path);
    } else if (path.startsWith("/api/housekeeping")) {
      response = await handleHousekeeping(request, env, auth, path);
    } else if (path.startsWith("/api/maintenance")) {
      response = await handleMaintenance(request, env, auth, path);
    } else if (path.startsWith("/api/menu") || path.startsWith("/api/orders")) {
      response = await handleMenu(request, env, auth, path);
    } else if (path.startsWith("/api/inventory")) {
      response = await handleInventory(request, env, auth, path);
    } else if (path.startsWith("/api/workflows")) {
      response = await handleWorkflows(request, env, auth, path);
    } else if (path.startsWith("/api/computer")) {
      console.log(`[index] Routing to computer: ${path}, method: ${request.method}`);
      console.log(`[index] Auth: tenantId=${auth.tenantId}, role=${auth.role}`);
      response = await handleComputer(request, env, auth, path);
    } else if (path.startsWith("/api/talla")) {
      // Chat endpoint goes to DO, other talla ops to routes
      if (path === "/api/talla/chat" && request.method === "POST") {
        response = await handleTallaChat(request, env);
      } else {
        response = await handleTallaOps(request, env, auth, path);
      }
    } else {
      response = Response.json({ error: "Not found" }, { status: 404 });
    }

    // Add CORS headers to response
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: { ...Object.fromEntries(response.headers), ...corsHeaders },
    });

    return newResponse;
  },
};
