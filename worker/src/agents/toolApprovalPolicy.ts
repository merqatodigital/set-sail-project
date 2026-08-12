// Tool approval policy — gates specific TALA tool actions behind durable
// owner approval via AgentWorkflow.
//
// This is the FIRST real durable approval capability for TallaAgent. The
// policy engine here intentionally mirrors the shape of the Computer
// policy (ALLOW / DENY / REQUIRES_APPROVAL) but applies to TALA tool
// actions rather than workspace file paths.
//
// The proof action is createHousekeepingTask: an existing, safe, internal
// write that is easy to verify (a row appears in housekeeping_tasks). It is
// marked REQUIRES_APPROVAL so the owner must approve before the side effect
// occurs. Adjust APPROVAL_REQUIRED_TOOLS to widen the gated set later.

export type ToolApprovalDecision = "ALLOW" | "DENY" | "REQUIRES_APPROVAL";

export interface ToolApprovalContext {
  actionName: string;
  role: string | null;
  tenantId: string;
}

export interface ToolApprovalResult {
  decision: ToolApprovalDecision;
  reason: string;
}

/**
 * Tool actions that require owner approval before execution.
 * Configurable — add tool names here to gate more actions.
 */
// createHousekeepingTask is intentionally NOT gated: guests asking for a room
// clean must actually create the task, not wait on an approval queue.
export const APPROVAL_REQUIRED_TOOLS: ReadonlySet<string> = new Set([
  "sendGuestEmail",
]);

/**
 * Evaluate whether a TALA tool action requires owner approval.
 *
 * Returns REQUIRES_APPROVAL for actions in APPROVAL_REQUIRED_TOOLS.
 * Everything else is allowed on the normal direct executeTool() path.
 */
export function evaluateToolApproval(ctx: ToolApprovalContext): ToolApprovalResult {
  if (APPROVAL_REQUIRED_TOOLS.has(ctx.actionName)) {
    return {
      decision: "REQUIRES_APPROVAL",
      reason: `Action "${ctx.actionName}" requires owner approval before it executes.`,
    };
  }
  return {
    decision: "ALLOW",
    reason: "Action does not require approval.",
  };
}
