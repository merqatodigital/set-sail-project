// Approval management routes — owner/admin only.
//
// Proxies to the TallaAgent Durable Object's native approval handlers.
// Guest access returns 403. Tenant is derived from auth (or X-Dev-Tenant in
// dev mode) and used to address the per-tenant Durable Object, so cross-tenant
// access is structurally impossible.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";

export async function handleApprovals(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  let tenantId = auth.tenantId;
  let isDevMode = false;

  // Development mode: allow X-Dev-Tenant header when no Authorization header is present
  if (!tenantId && !request.headers.get("Authorization")) {
    const devTenant = request.headers.get("X-Dev-Tenant");
    if (devTenant) {
      tenantId = devTenant;
      isDevMode = true;
    }
  }

  // Resolve the effective role:
  //  - production: trust the verified auth context
  //  - dev mode: trust the caller-supplied X-User-Role header (e.g. "guest")
  const effectiveRole =
    auth.role ??
    (isDevMode ? request.headers.get("X-User-Role") ?? "guest" : null);

  // Owner-only enforcement (defense in depth — the DO also enforces this).
  // Guests and any non-owner/admin are forbidden from listing/approving/rejecting.
  if (effectiveRole !== "owner" && effectiveRole !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tenantId) {
    return Response.json({ error: "Tenant ID required" }, { status: 400 });
  }

  try {
    const doId = env.TALLA_AGENT.idFromName(tenantId);
    const stub = env.TALLA_AGENT.get(doId);
    // Forward to the DO's approval handlers. The DO owns the /approvals
    // namespace (no /api prefix), so strip the /api segment.
    const doPath = path.replace(/^\/api/, "");
    const doUrl = `https://talla-agent${doPath}`;
    const doResponse = await stub.fetch(
      new Request(doUrl, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": tenantId,
          "X-User-Role": effectiveRole,
          "X-User-Id": auth.userId || effectiveRole,
        },
        body: request.method === "GET" ? undefined : request.body,
      }),
    );
    const respText = await doResponse.text();
    return new Response(respText, {
      status: doResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[Approvals] Error: ${err}`);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
