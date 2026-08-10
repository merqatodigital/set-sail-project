// Audit logging for TallaAgent guest-state adapter tools. Follows the existing
// browser_audit / email_log pattern: D1 only, safe metadata, no secrets/payloads.

import type { D1Database } from "@cloudflare/workers-types";

export interface GuestStateAuditInput {
  tenantId: string;
  tool: string;
  role: string;
  guestName: string;
  success: boolean;
  error?: string;
}

export async function logGuestState(
  db: D1Database,
  input: GuestStateAuditInput,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO guest_state_audit (id, tenant_id, tool, role, guest_name, success, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        input.tenantId,
        input.tool,
        input.role,
        input.guestName ?? "",
        input.success ? 1 : 0,
        (input.error ?? "").slice(0, 500),
      )
      .run();
  } catch {
    // audit must never break the tool path
  }
}
