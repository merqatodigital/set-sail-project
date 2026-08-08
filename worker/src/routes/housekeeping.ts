// Housekeeping routes — task management for room/area cleaning.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import {
  createHousekeepingTask,
  listHousekeepingTasks,
  getHousekeepingTask,
  updateHousekeepingTaskStatus,
  deleteHousekeepingTask,
} from "../db/repos/housekeepingRepo.js";
import { CreateHousekeepingTaskSchema, UpdateHousekeepingStatusSchema } from "../schemas/phase4.js";

export async function handleHousekeeping(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  const ctx = createRequestContext(request, path, auth.userId, auth.tenantId);

  try {
    const authErr = requireAuth(auth);
    if (authErr) {
      logRequest(ctx, 401);
      return authErr;
    }
    const tenantErr = requireTenant(auth);
    if (tenantErr) {
      logRequest(ctx, 403);
      return tenantErr;
    }

    // POST /api/housekeeping — create task
    if (path === "/api/housekeeping" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateHousekeepingTaskSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      const task = await createHousekeepingTask(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ task }, { status: 201 });
    }

    // GET /api/housekeeping — list tasks
    if (path === "/api/housekeeping" && request.method === "GET") {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const room = url.searchParams.get("room") || undefined;
      const limit = url.searchParams.get("limit");
      const tasks = await listHousekeepingTasks(env.DB, auth.tenantId!, {
        status,
        room,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ tasks });
    }

    // GET /api/housekeeping/:id — single task
    const singleMatch = path.match(/^\/api\/housekeeping\/([^/]+)$/);
    if (singleMatch && request.method === "GET") {
      const task = await getHousekeepingTask(env.DB, auth.tenantId!, singleMatch[1]);
      if (!task) {
        logRequest(ctx, 404);
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ task });
    }

    // PATCH /api/housekeeping/:id/status — update status
    const statusMatch = path.match(/^\/api\/housekeeping\/([^/]+)\/status$/);
    if (statusMatch && request.method === "PATCH") {
      const body = await request.json();
      const parsed = UpdateHousekeepingStatusSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      try {
        const task = await updateHousekeepingTaskStatus(
          env.DB,
          auth.tenantId!,
          statusMatch[1],
          parsed.data.status,
        );
        if (!task) {
          logRequest(ctx, 404);
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        logRequest(ctx, 200);
        return Response.json({ task });
      } catch (e) {
        logRequest(ctx, 400);
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    }

    // DELETE /api/housekeeping/:id
    const deleteMatch = path.match(/^\/api\/housekeeping\/([^/]+)$/);
    if (deleteMatch && request.method === "DELETE") {
      await deleteHousekeepingTask(env.DB, auth.tenantId!, deleteMatch[1]);
      logRequest(ctx, 200);
      return Response.json({ ok: true });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[housekeeping] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
