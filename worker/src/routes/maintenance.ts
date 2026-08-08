// Maintenance routes — issue tracking and repair requests.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import {
  createMaintenanceRequest,
  listMaintenanceRequests,
  getMaintenanceRequest,
  updateMaintenanceRequestStatus,
  deleteMaintenanceRequest,
} from "../db/repos/maintenanceRepo.js";
import {
  CreateMaintenanceRequestSchema,
  UpdateMaintenanceStatusSchema,
} from "../schemas/phase4.js";

export async function handleMaintenance(
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

    // POST /api/maintenance — create request
    if (path === "/api/maintenance" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateMaintenanceRequestSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      const request_ = await createMaintenanceRequest(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ request: request_ }, { status: 201 });
    }

    // GET /api/maintenance — list requests
    if (path === "/api/maintenance" && request.method === "GET") {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const priority = url.searchParams.get("priority") || undefined;
      const limit = url.searchParams.get("limit");
      const requests = await listMaintenanceRequests(env.DB, auth.tenantId!, {
        status,
        priority,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ requests });
    }

    // GET /api/maintenance/:id — single request
    const singleMatch = path.match(/^\/api\/maintenance\/([^/]+)$/);
    if (singleMatch && request.method === "GET") {
      const request_ = await getMaintenanceRequest(env.DB, auth.tenantId!, singleMatch[1]);
      if (!request_) {
        logRequest(ctx, 404);
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ request: request_ });
    }

    // PATCH /api/maintenance/:id/status — update status
    const statusMatch = path.match(/^\/api\/maintenance\/([^/]+)\/status$/);
    if (statusMatch && request.method === "PATCH") {
      const body = await request.json();
      const parsed = UpdateMaintenanceStatusSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      try {
        const request_ = await updateMaintenanceRequestStatus(
          env.DB,
          auth.tenantId!,
          statusMatch[1],
          parsed.data.status,
        );
        if (!request_) {
          logRequest(ctx, 404);
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        logRequest(ctx, 200);
        return Response.json({ request: request_ });
      } catch (e) {
        logRequest(ctx, 400);
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    }

    // DELETE /api/maintenance/:id
    const deleteMatch = path.match(/^\/api\/maintenance\/([^/]+)$/);
    if (deleteMatch && request.method === "DELETE") {
      await deleteMaintenanceRequest(env.DB, auth.tenantId!, deleteMatch[1]);
      logRequest(ctx, 200);
      return Response.json({ ok: true });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[maintenance] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
