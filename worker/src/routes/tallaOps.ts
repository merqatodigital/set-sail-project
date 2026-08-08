// Talla ops routes — tasks, leads, goals, briefings, wins.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import * as tallaOps from "../db/repos/tallaOpsRepo.js";
import {
  CreateTalaTaskSchema,
  UpdateTalaTaskStatusSchema,
  CreateTalaLeadSchema,
  CreateTalaGoalSchema,
  UpdateTalaGoalStatusSchema,
  CreateTalaBriefingSchema,
  CreateTalaWinSchema,
} from "../schemas/phase4.js";

export async function handleTallaOps(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  const ctx = createRequestContext(request, path, auth.userId, auth.tenantId);

  try {
    const authErr = requireAuth(auth);
    if (authErr) { logRequest(ctx, 401); return authErr; }
    const tenantErr = requireTenant(auth);
    if (tenantErr) { logRequest(ctx, 403); return tenantErr; }

    // ---- Tasks ----

    if (path === "/api/talla/tasks" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateTalaTaskSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const task = await tallaOps.createTask(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ task }, { status: 201 });
    }

    if (path === "/api/talla/tasks" && request.method === "GET") {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const category = url.searchParams.get("category") || undefined;
      const tasks = await tallaOps.listTasks(env.DB, auth.tenantId!, { status, category });
      logRequest(ctx, 200);
      return Response.json({ tasks });
    }

    const taskStatusMatch = path.match(/^\/api\/talla\/tasks\/([^/]+)\/status$/);
    if (taskStatusMatch && request.method === "PATCH") {
      const body = await request.json();
      const parsed = UpdateTalaTaskStatusSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const task = await tallaOps.updateTaskStatus(env.DB, auth.tenantId!, taskStatusMatch[1], parsed.data.status);
      if (!task) { logRequest(ctx, 404); return Response.json({ error: "Not found" }, { status: 404 }); }
      logRequest(ctx, 200);
      return Response.json({ task });
    }

    // ---- Leads ----

    if (path === "/api/talla/leads" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateTalaLeadSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const lead = await tallaOps.createLead(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ lead }, { status: 201 });
    }

    if (path === "/api/talla/leads" && request.method === "GET") {
      const url = new URL(request.url);
      const source = url.searchParams.get("source") || undefined;
      const limit = url.searchParams.get("limit");
      const leads = await tallaOps.listLeads(env.DB, auth.tenantId!, {
        source,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ leads });
    }

    // ---- Goals ----

    if (path === "/api/talla/goals" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateTalaGoalSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const goal = await tallaOps.createGoal(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ goal }, { status: 201 });
    }

    if (path === "/api/talla/goals" && request.method === "GET") {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const goals = await tallaOps.listGoals(env.DB, auth.tenantId!, { status });
      logRequest(ctx, 200);
      return Response.json({ goals });
    }

    const goalStatusMatch = path.match(/^\/api\/talla\/goals\/([^/]+)\/status$/);
    if (goalStatusMatch && request.method === "PATCH") {
      const body = await request.json();
      const parsed = UpdateTalaGoalStatusSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const goal = await tallaOps.updateGoalStatus(env.DB, auth.tenantId!, goalStatusMatch[1], parsed.data.status);
      if (!goal) { logRequest(ctx, 404); return Response.json({ error: "Not found" }, { status: 404 }); }
      logRequest(ctx, 200);
      return Response.json({ goal });
    }

    // ---- Briefings ----

    if (path === "/api/talla/briefings" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateTalaBriefingSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const briefing = await tallaOps.createBriefing(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ briefing }, { status: 201 });
    }

    if (path === "/api/talla/briefings" && request.method === "GET") {
      const url = new URL(request.url);
      const limit = url.searchParams.get("limit");
      const briefings = await tallaOps.listBriefings(env.DB, auth.tenantId!, {
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ briefings });
    }

    const briefingSentMatch = path.match(/^\/api\/talla\/briefings\/([^/]+)\/sent$/);
    if (briefingSentMatch && request.method === "PATCH") {
      const briefing = await tallaOps.markBriefingWhatsappSent(env.DB, auth.tenantId!, briefingSentMatch[1]);
      if (!briefing) { logRequest(ctx, 404); return Response.json({ error: "Not found" }, { status: 404 }); }
      logRequest(ctx, 200);
      return Response.json({ briefing });
    }

    // ---- Wins ----

    if (path === "/api/talla/wins" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateTalaWinSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const win = await tallaOps.createWin(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ win }, { status: 201 });
    }

    if (path === "/api/talla/wins" && request.method === "GET") {
      const url = new URL(request.url);
      const limit = url.searchParams.get("limit");
      const wins = await tallaOps.listWins(env.DB, auth.tenantId!, {
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ wins });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[talla-ops] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
