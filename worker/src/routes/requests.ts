// Guest requests routes — write vertical slice.
// Demonstrates: UI → Worker → validation → auth → tenant guard → D1 → authoritative response

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import {
  createGuestRequest,
  listGuestRequests,
  getGuestRequest,
  updateGuestRequestStatus,
} from "../db/repos/guestRequestRepo.js";
import { CreateGuestRequestSchema, UpdateStatusSchema } from "../schemas/requests.js";

export async function handleGuestRequests(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  const ctx = createRequestContext(request, path, auth.userId, auth.tenantId);

  try {
    // All guest request endpoints require authentication + tenant
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

    // POST /api/requests — create a new guest request
    if (path === "/api/requests" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateGuestRequestSchema.safeParse(body);

      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          {
            error: "Validation failed",
            details: parsed.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 },
        );
      }

      const record = await createGuestRequest(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ request: record }, { status: 201 });
    }

    // GET /api/requests — list requests (with optional filters)
    if (path === "/api/requests" && request.method === "GET") {
      const url = new URL(request.url);
      const type = url.searchParams.get("type") || undefined;
      const status = url.searchParams.get("status") || undefined;
      const limit = url.searchParams.get("limit");

      const requests = await listGuestRequests(env.DB, auth.tenantId!, {
        type,
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ requests });
    }

    // GET /api/requests/:id — single request
    const singleMatch = path.match(/^\/api\/requests\/([^/]+)$/);
    if (singleMatch && request.method === "GET") {
      const requestId = singleMatch[1];
      const record = await getGuestRequest(env.DB, auth.tenantId!, requestId);
      if (!record) {
        logRequest(ctx, 404);
        return Response.json({ error: "Request not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ request: record });
    }

    // PATCH /api/requests/:id/status — update status
    const statusMatch = path.match(/^\/api\/requests\/([^/]+)\/status$/);
    if (statusMatch && request.method === "PATCH") {
      const requestId = statusMatch[1];
      const body = await request.json();
      const parsed = UpdateStatusSchema.safeParse(body);

      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          {
            error: "Validation failed",
            details: parsed.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 },
        );
      }

      const record = await updateGuestRequestStatus(
        env.DB,
        auth.tenantId!,
        requestId,
        parsed.data.status,
      );

      if (!record) {
        logRequest(ctx, 404);
        return Response.json({ error: "Request not found" }, { status: 404 });
      }

      logRequest(ctx, 200);
      return Response.json({ request: record });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[requests] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
