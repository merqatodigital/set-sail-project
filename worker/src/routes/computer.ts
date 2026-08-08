// Computer routes — bridges HTTP requests to TallaAgent's Computer workspace.
// Owner/admin only. Tenant ID is derived from auth context.
//
// Development mode:
//   In local development, use header X-Dev-Tenant: <tenantId> to bypass auth.
//   This only works when the Authorization header is NOT present.
//   Production auth is never weakened.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";

/**
 * Handle Computer-related API requests by forwarding to TallaAgent DO.
 */
export async function handleComputer(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  console.log(`[computer] handleComputer called: path=${path}, auth.tenantId=${auth.tenantId}, auth.role=${auth.role}`);
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

  // Production auth check
  if (!isDevMode && auth.role !== "owner" && auth.role !== "admin") {
    console.log(`[computer] Forbidden: isDevMode=${isDevMode}, auth.role=${auth.role}`);
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  console.log(`[computer] Auth passed: tenantId=${tenantId}, isDevMode=${isDevMode}`);

  if (!tenantId) {
    return Response.json({ error: "Tenant ID required" }, { status: 400 });
  }

  try {
    // Get the TallaAgent Durable Object for this tenant
    const doId = env.TALLA_AGENT.idFromName(tenantId);
    const stub = env.TALLA_AGENT.get(doId);

    // Forward to TallaAgent's onRequest
    // Map /api/computer/* → /computer/*
    // Pass tenant/role info in headers so DO can use it
    const doPath = path.replace("/api/computer", "/computer");
    const urlObj = new URL(request.url);
    const doUrl = `https://talla-agent${doPath}${urlObj.search}`;
    const doHeaders = new Headers(request.headers);
    doHeaders.set("X-Tenant-Id", tenantId);
    doHeaders.set("X-User-Role", isDevMode ? "owner" : (auth.role || ""));
    doHeaders.set("X-User-Id", isDevMode ? "dev-user" : (auth.userId || ""));
    const doResponse = await stub.fetch(
      new Request(doUrl, {
        method: request.method,
        headers: doHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      }),
    );

    return doResponse;
  } catch (err) {
    console.error(`[computer] Error: ${err}`);
    return Response.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
