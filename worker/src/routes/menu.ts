// Menu routes — menu item CRUD and food order management.
// CRITICAL: Prices are authoritative server-side only.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant, requireAdmin } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import {
  listMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../db/repos/menuRepo.js";
import {
  createFoodOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
} from "../db/repos/foodOrderRepo.js";
import {
  CreateMenuItemSchema,
  UpdateMenuItemSchema,
  CreateFoodOrderSchema,
  UpdateOrderStatusSchema,
} from "../schemas/phase4.js";

export async function handleMenu(
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

    // ---- Menu Items ----

    // GET /api/menu — list menu items (public for authenticated users)
    if (path === "/api/menu" && request.method === "GET") {
      const url = new URL(request.url);
      const category = url.searchParams.get("category") || undefined;
      const activeOnly = url.searchParams.get("active") !== "false";
      const items = await listMenuItems(env.DB, auth.tenantId!, { activeOnly, category });
      logRequest(ctx, 200);
      return Response.json({ items });
    }

    // GET /api/menu/:id — single menu item
    const menuItemMatch = path.match(/^\/api\/menu\/([^/]+)$/);
    if (menuItemMatch && request.method === "GET") {
      const item = await getMenuItem(env.DB, auth.tenantId!, menuItemMatch[1]);
      if (!item) {
        logRequest(ctx, 404);
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ item });
    }

    // POST /api/menu — create menu item (admin only)
    if (path === "/api/menu" && request.method === "POST") {
      const adminErr = requireAdmin(auth);
      if (adminErr) {
        logRequest(ctx, 403);
        return adminErr;
      }

      const body = await request.json();
      const parsed = CreateMenuItemSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      const item = await createMenuItem(env.DB, auth.tenantId!, parsed.data);
      logRequest(ctx, 201);
      return Response.json({ item }, { status: 201 });
    }

    // PUT /api/menu/:id — update menu item (admin only)
    if (menuItemMatch && request.method === "PUT") {
      const adminErr = requireAdmin(auth);
      if (adminErr) {
        logRequest(ctx, 403);
        return adminErr;
      }

      const body = await request.json();
      const parsed = UpdateMenuItemSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      const item = await updateMenuItem(env.DB, auth.tenantId!, menuItemMatch[1], parsed.data);
      if (!item) {
        logRequest(ctx, 404);
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ item });
    }

    // DELETE /api/menu/:id (admin only)
    if (menuItemMatch && request.method === "DELETE") {
      const adminErr = requireAdmin(auth);
      if (adminErr) {
        logRequest(ctx, 403);
        return adminErr;
      }

      await deleteMenuItem(env.DB, auth.tenantId!, menuItemMatch[1]);
      logRequest(ctx, 200);
      return Response.json({ ok: true });
    }

    // ---- Food Orders ----

    // POST /api/orders — create food order
    if (path === "/api/orders" && request.method === "POST") {
      const body = await request.json();
      const parsed = CreateFoodOrderSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }

      // Load menu items for price verification
      const menuItems = await listMenuItems(env.DB, auth.tenantId!, { activeOnly: true });

      try {
        const order = await createFoodOrder(env.DB, auth.tenantId!, parsed.data, menuItems);
        logRequest(ctx, 201);
        return Response.json({ order }, { status: 201 });
      } catch (e) {
        logRequest(ctx, 400);
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    }

    // GET /api/orders — list orders
    if (path === "/api/orders" && request.method === "GET") {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const limit = url.searchParams.get("limit");
      const orders = await listOrders(env.DB, auth.tenantId!, {
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      logRequest(ctx, 200);
      return Response.json({ orders });
    }

    // GET /api/orders/:id — single order
    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch && request.method === "GET") {
      const order = await getOrder(env.DB, auth.tenantId!, orderMatch[1]);
      if (!order) {
        logRequest(ctx, 404);
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      logRequest(ctx, 200);
      return Response.json({ order });
    }

    // PATCH /api/orders/:id/status — update order status
    const orderStatusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (orderStatusMatch && request.method === "PATCH") {
      const body = await request.json();
      const parsed = UpdateOrderStatusSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json(
          { error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      try {
        const order = await updateOrderStatus(
          env.DB,
          auth.tenantId!,
          orderStatusMatch[1],
          parsed.data.status,
        );
        if (!order) {
          logRequest(ctx, 404);
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        logRequest(ctx, 200);
        return Response.json({ order });
      } catch (e) {
        logRequest(ctx, 400);
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[menu] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
