// Authentication middleware — bridges Supabase Auth to Cloudflare Worker.
//
// How it works:
// 1. Extracts Bearer token from Authorization header
// 2. Verifies JWT by calling Supabase's /auth/v1/user endpoint
// 3. Resolves tenant membership from D1 tenant_members table
// 4. Returns AuthContext with userId, tenantId, and role
//
// This does NOT replace Supabase Auth. It temporarily bridges it
// so the Worker can independently verify identity before touching D1.

import type { AuthContext } from "./context.js";
import type { Env } from "../env.js";

const UNAUTHENTICATED: AuthContext = {
  authenticated: false,
  userId: null,
  tenantId: null,
  role: null,
};

/**
 * Resolve authentication context from the request.
 * Returns UNAUTHENTICATED if token is missing or invalid.
 * Never throws — callers should handle the unauthenticated case.
 */
export async function resolveAuth(request: Request, env: Env): Promise<AuthContext> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return UNAUTHENTICATED;
  }

  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    return UNAUTHENTICATED;
  }

  // Step 1: Verify the JWT with Supabase
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[auth] SUPABASE_URL or SUPABASE_ANON_KEY not configured");
    return UNAUTHENTICATED;
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!userRes.ok) {
      return UNAUTHENTICATED;
    }

    const user = (await userRes.json()) as { id?: string; email?: string };
    if (!user.id) {
      return UNAUTHENTICATED;
    }

    // Step 2: Resolve tenant membership from D1
    const { results } = await env.DB.prepare(
      `SELECT tm.tenant_id, tm.role
       FROM tenant_members tm
       WHERE tm.user_id = ?1
       ORDER BY CASE tm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
       LIMIT 1`,
    )
      .bind(user.id)
      .all<{ tenant_id: string; role: string }>();

    if (results.length === 0) {
      // Authenticated but no tenant membership — still return userId
      return {
        authenticated: true,
        userId: user.id,
        tenantId: null,
        role: null,
      };
    }

    return {
      authenticated: true,
      userId: user.id,
      tenantId: results[0].tenant_id,
      role: results[0].role,
    };
  } catch (err) {
    console.error("[auth] Token verification failed:", err);
    return UNAUTHENTICATED;
  }
}

/**
 * Middleware that enforces authentication.
 * Returns Response if request should be rejected, null if ok.
 */
export function requireAuth(auth: AuthContext): Response | null {
  if (!auth.authenticated) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  return null;
}

/**
 * Middleware that enforces tenant membership.
 * Returns Response if request should be rejected, null if ok.
 */
export function requireTenant(auth: AuthContext): Response | null {
  if (!auth.tenantId) {
    return Response.json({ error: "No tenant access" }, { status: 403 });
  }
  return null;
}

/**
 * Middleware that enforces admin or owner role.
 * Returns Response if request should be rejected, null if ok.
 */
export function requireAdmin(auth: AuthContext): Response | null {
  if (!auth.authenticated) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!auth.tenantId) {
    return Response.json({ error: "No tenant access" }, { status: 403 });
  }
  if (auth.role !== "owner" && auth.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}
