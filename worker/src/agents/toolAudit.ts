// Tool audit logging — records tool execution for observability.
// Logs safely: no secrets, no full conversations, just tool execution metadata.

import type { ToolAuditEntry } from "./types.js";

/**
 * Log a tool execution to D1 audit table.
 * Fire-and-forget — do not block agent response.
 */
export async function logToolExecution(
  db: D1Database,
  entry: ToolAuditEntry,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO tool_audit_log (id, tenant_id, user_id, session_id, tool_name, start_time, end_time, success, duration_ms, safe_result, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        crypto.randomUUID(),
        entry.tenantId,
        entry.userId ?? "",
        entry.sessionId,
        entry.toolName,
        entry.startTime,
        entry.endTime,
        entry.success ? 1 : 0,
        entry.durationMs,
        entry.safeResult ?? "",
        entry.error ?? "",
      )
      .run();
  } catch (err) {
    // Audit logging should never crash the agent
    console.error("[tool-audit] Failed to log:", err);
  }
}

/**
 * Create a tool audit wrapper that times execution and logs results.
 */
export function createAuditWrapper(
  db: D1Database,
  tenantId: string,
  userId: string | null,
  sessionId: string,
) {
  return async function auditToolExecution<T>(
    toolName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = new Date().toISOString();
    const startMs = Date.now();

    try {
      const result = await fn();
      const endTime = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      // Safe result summary — never log full data
      let safeResult = "success";
      if (result && typeof result === "object" && "success" in result) {
        safeResult = (result as { success: boolean }).success ? "success" : "failure";
      }

      logToolExecution(db, {
        requestId: crypto.randomUUID(),
        tenantId,
        userId,
        sessionId,
        toolName,
        startTime,
        endTime,
        success: true,
        durationMs,
        safeResult,
      }).catch(() => {}); // fire-and-forget

      return result;
    } catch (err) {
      const endTime = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      logToolExecution(db, {
        requestId: crypto.randomUUID(),
        tenantId,
        userId,
        sessionId,
        toolName,
        startTime,
        endTime,
        success: false,
        durationMs,
        error: (err as Error).message,
      }).catch(() => {}); // fire-and-forget

      throw err;
    }
  };
}
