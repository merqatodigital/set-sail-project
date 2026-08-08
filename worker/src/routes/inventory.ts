// Inventory routes — stock tracking and adjustments.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant, requireAdmin } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import {
  listInventory,
  getInventoryItem,
  upsertInventoryItem,
  bulkUpsertInventory,
  deleteInventoryItem,
  adjustInventoryQuantity,
} from "../db/repos/inventoryRepo.js";
import { UpsertInventoryItemSchema, AdjustInventorySchema } from "../schemas/phase4.js";

export async function handleInventory(
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

    // GET /api/inventory — list items
    if (path === "/api/inventory" && request.method === "GET") {
      const url = new URL(request.url);
      const category = url.searchParams.get("category") || undefined;
      const lowStock = url.searchParams.get("lowStock") === "true";
      const items = await listInventory(env.DB, auth.tenantId!, { category, lowStock });
      logRequest(ctx, 200);
      return Response.json({ items });
    }

    // GET /api/inventory/:id — single item
    const singleMatch = path.match(/^\/api\/inventory\/([^/]+)$/);
    if (singleMatch && request.method === "GET") {
      const item = await getInventoryItem(env.DB, auth.tenantId!, singleMatch[1]);
      if (!item) { logRequest(ctx, 404); return Response.json({ error: "Not found" }, { status: 404 }); }
      logRequest(ctx, 200);
      return Response.json({ item });
    }

    // POST /api/inventory — create/update item (admin)
    if (path === "/api/inventory" && request.method === "POST") {
      const adminErr = requireAdmin(auth);
      if (adminErr) { logRequest(ctx, 403); return adminErr; }

      const body = await request.json();
      const parsed = UpsertInventoryItemSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const item = await upsertInventoryItem(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ item }, { status: 201 });
    }

    // PUT /api/inventory/bulk — bulk upsert (admin)
    if (path === "/api/inventory/bulk" && request.method === "PUT") {
      const adminErr = requireAdmin(auth);
      if (adminErr) { logRequest(ctx, 403); return adminErr; }

      const body = await request.json() as { items?: Array<{ id?: string; name: string; category?: string; unit?: string; quantity: number; reorderThreshold?: number; unitCost?: number; notes?: string }> };
      const items = body.items;
      if (!Array.isArray(items) || items.length === 0) {
        logRequest(ctx, 400);
        return Response.json({ error: "Items array required" }, { status: 400 });
      }
      await bulkUpsertInventory(env.DB, auth.tenantId!, items);
      logRequest(ctx, 200);
      return Response.json({ ok: true, count: items.length });
    }

    // PATCH /api/inventory/:id/adjust — adjust quantity
    const adjustMatch = path.match(/^\/api\/inventory\/([^/]+)\/adjust$/);
    if (adjustMatch && request.method === "PATCH") {
      const body = await request.json();
      const parsed = AdjustInventorySchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }
      const item = await adjustInventoryQuantity(env.DB, auth.tenantId!, adjustMatch[1], parsed.data.adjustment);
      if (!item) { logRequest(ctx, 404); return Response.json({ error: "Not found" }, { status: 404 }); }
      logRequest(ctx, 200);
      return Response.json({ item });
    }

    // DELETE /api/inventory/:id (admin)
    const deleteMatch = path.match(/^\/api\/inventory\/([^/]+)$/);
    if (deleteMatch && request.method === "DELETE") {
      const adminErr = requireAdmin(auth);
      if (adminErr) { logRequest(ctx, 403); return adminErr; }

      await deleteInventoryItem(env.DB, auth.tenantId!, deleteMatch[1]);
      logRequest(ctx, 200);
      return Response.json({ ok: true });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[inventory] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
