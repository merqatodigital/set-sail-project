// Tours routes — read vertical slice.
// Demonstrates: React → Worker → auth → tenant guard → D1 → response

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import { listActiveTours, listAllTours, getTour } from "../db/repos/toursRepo.js";

export async function handleTours(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  const ctx = createRequestContext(request, path, auth.userId, auth.tenantId);

  try {
    // Public endpoint: GET /api/tours/active — no auth required
    if (path === "/api/tours/active" && request.method === "GET") {
      // Require tenant for scoping, but not auth
      const tenantErr = requireTenant(auth);
      if (tenantErr) {
        logRequest(ctx, 403);
        return tenantErr;
      }

      const tours = await listActiveTours(env.DB, auth.tenantId!);
      logRequest(ctx, 200);
      return Response.json({ tours });
    }

    // Authenticated endpoints below
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

    // GET /api/tours — list all tours (admin)
    if (path === "/api/tours" && request.method === "GET") {
      const tours = await listAllTours(env.DB, auth.tenantId!);
      logRequest(ctx, 200);
      return Response.json({ tours });
    }

    // GET /api/tours/:id — single tour
    const singleMatch = path.match(/^\/api\/tours\/([^/]+)$/);
    if (singleMatch && request.method === "GET") {
      const tourId = singleMatch[1];
      const tour = await getTour(env.DB, auth.tenantId!, tourId);
      if (!tour) {
        logRequest(ctx, 404);
        return Response.json({ error: "Tour not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ tour });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[tours] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
