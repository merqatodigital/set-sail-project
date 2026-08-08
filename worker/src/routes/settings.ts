// Property settings routes — structured settings per tenant.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";
import { requireAuth, requireTenant, requireAdmin } from "../auth/middleware.js";
import { createRequestContext, logRequest } from "../middleware/logger.js";
import {
  getAllSettings,
  getSettingsByCategory,
  upsertSetting,
  upsertSettingsBatch,
  deleteSetting,
} from "../db/repos/propertySettingsRepo.js";
import { UpsertSettingSchema, UpsertSettingsBatchSchema } from "../schemas/phase4.js";

export async function handlePropertySettings(
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

    // GET /api/settings — all settings
    if (path === "/api/settings" && request.method === "GET") {
      const settings = await getAllSettings(env.DB, auth.tenantId!);
      logRequest(ctx, 200);
      return Response.json({ settings });
    }

    // GET /api/settings/:category — settings by category
    const categoryMatch = path.match(/^\/api\/settings\/([^/]+)$/);
    if (categoryMatch && request.method === "GET") {
      const category = categoryMatch[1];
      const settings = await getSettingsByCategory(env.DB, auth.tenantId!, category);
      logRequest(ctx, 200);
      return Response.json({ settings });
    }

    // PUT /api/settings — upsert single setting
    if (path === "/api/settings" && request.method === "PUT") {
      const adminErr = requireAdmin(auth);
      if (adminErr) { logRequest(ctx, 403); return adminErr; }

      const body = await request.json();
      const parsed = UpsertSettingSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }

      const setting = await upsertSetting(env.DB, auth.tenantId!, parsed.data.category, parsed.data.key, parsed.data.value);
      logRequest(ctx, 200);
      return Response.json({ setting });
    }

    // PUT /api/settings/batch — upsert multiple settings
    if (path === "/api/settings/batch" && request.method === "PUT") {
      const adminErr = requireAdmin(auth);
      if (adminErr) { logRequest(ctx, 403); return adminErr; }

      const body = await request.json();
      const parsed = UpsertSettingsBatchSchema.safeParse(body);
      if (!parsed.success) {
        logRequest(ctx, 400);
        return Response.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }

      await upsertSettingsBatch(env.DB, auth.tenantId!, parsed.data.settings);
      logRequest(ctx, 200);
      return Response.json({ ok: true });
    }

    // DELETE /api/settings/:key
    const keyMatch = path.match(/^\/api\/settings\/([^/]+)$/);
    if (keyMatch && request.method === "DELETE") {
      const adminErr = requireAdmin(auth);
      if (adminErr) { logRequest(ctx, 403); return adminErr; }

      const key = keyMatch[1];
      await deleteSetting(env.DB, auth.tenantId!, key);
      logRequest(ctx, 200);
      return Response.json({ ok: true });
    }

    logRequest(ctx, 404);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[settings] Error:`, err);
    logRequest(ctx, 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
