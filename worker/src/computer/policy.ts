// Policy engine — controls what Talla may do with the Computer workspace.
//
// Architecture:
//   LLM intent → Talla Computer Tool → Policy Engine → ALLOW/DENY/REQUIRE_APPROVAL → Workspace
//
// Every action goes through policy. The LLM never gets unrestricted access.
// Policy decisions are logged for audit.

import type { PolicyContext, PolicyResult, PolicyDecision } from "./types.js";
import { isCrossTenantAccess } from "./paths.js";

const ROOT = "/talla";

// ---- Policy rules ----

interface PolicyRule {
  /** Human-readable name */
  name: string;
  /** Test if this rule applies */
  matches: (ctx: PolicyContext) => boolean;
  /** The decision if this rule matches */
  decision: PolicyDecision;
  /** Reason for the decision */
  reason: string;
}

const POLICY_RULES: PolicyRule[] = [
  // ---- BLOCKED: Secret/system access ----
  {
    name: "block-secret-access",
    matches: (ctx) =>
      /\.(env|secret|key|pem|credential|token)$/i.test(ctx.path) ||
      /secret|credential|apikey|api_key/i.test(ctx.path),
    decision: "BLOCKED",
    reason: "Access to secrets and credentials is strictly prohibited.",
  },
  {
    name: "block-system-paths",
    matches: (ctx) => /\/(etc|var|usr|proc|sys|dev)\//.test(ctx.path),
    decision: "BLOCKED",
    reason: "Access to system paths is prohibited.",
  },

  // ---- BLOCKED: Cross-tenant access ----
  {
    name: "block-cross-tenant",
    matches: (ctx) => isCrossTenantAccess(ctx.path, ctx.tenantId),
    decision: "BLOCKED",
    reason: "Cross-tenant workspace access is prohibited.",
  },

  // ---- BLOCKED: Path escape ----
  {
    name: "block-path-escape",
    matches: (ctx) => !ctx.path.startsWith(ROOT),
    decision: "BLOCKED",
    reason: "Workspace access is restricted to /talla/ directory.",
  },

  // ---- BLOCKED: Dangerous operations ----
  {
    name: "block-policy-modification",
    matches: (ctx) =>
      ctx.action === "exec" &&
      /policy|permission|auth|credential|secret/i.test(ctx.path),
    decision: "BLOCKED",
    reason: "Modification of security policy is prohibited.",
  },

  // ---- REQUIRES APPROVAL: Publishing/external actions ----
  {
    name: "approve-publish",
    matches: (ctx) =>
      ctx.action === "publish" ||
      ctx.action === "deploy" ||
      ctx.action === "push",
    decision: "REQUIRES_APPROVAL",
    reason: "Publishing and deployment actions require owner approval.",
  },
  {
    name: "approve-external-comms",
    matches: (ctx) =>
      ctx.action === "send_email" ||
      ctx.action === "send_bulk" ||
      ctx.action === "marketing",
    decision: "REQUIRES_APPROVAL",
    reason: "External communications require owner approval.",
  },
  {
    name: "approve-financial",
    matches: (ctx) =>
      ctx.action === "purchase" ||
      ctx.action === "refund" ||
      ctx.action === "financial",
    decision: "REQUIRES_APPROVAL",
    reason: "Financial actions require owner approval.",
  },
  {
    name: "approve-delete",
    matches: (ctx) =>
      ctx.action === "delete" &&
      /report|document|campaign/i.test(ctx.path),
    decision: "REQUIRES_APPROVAL",
    reason: "Deleting significant data requires owner approval.",
  },

  // ---- AUTO-APPROVED: Read operations ----
  {
    name: "auto-read",
    matches: (ctx) => ctx.action === "read" || ctx.action === "list" || ctx.action === "search",
    decision: "AUTO_APPROVED",
    reason: "Read operations within workspace are permitted.",
  },

  // ---- AUTO-APPROVED: Write to permitted paths ----
  {
    name: "auto-write-operations",
    matches: (ctx) =>
      ctx.action === "write" &&
      (ctx.path.includes("/reports/") ||
        ctx.path.includes("/working/") ||
        ctx.path.includes("/generated/") ||
        ctx.path.includes("/knowledge/") ||
        ctx.path.includes("/logs/")),
    decision: "AUTO_APPROVED",
    reason: "Writing to Talla's operational directories is permitted.",
  },
  {
    name: "auto-write-documents",
    matches: (ctx) =>
      ctx.action === "write" &&
      ctx.path.includes("/documents/"),
    decision: "AUTO_APPROVED",
    reason: "Writing to documents directory is permitted.",
  },

  // ---- Default: require approval for unknown write actions ----
  {
    name: "default-write",
    matches: (ctx) => ctx.action === "write" || ctx.action === "exec" || ctx.action === "delete",
    decision: "REQUIRES_APPROVAL",
    reason: "This action requires owner approval.",
  },
];

/**
 * Evaluate a policy context against all rules.
 * Returns the first matching rule's decision.
 */
export function evaluatePolicy(ctx: PolicyContext): PolicyResult {
  // Role-based gating: only owner/admin can use Computer
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return {
      decision: "BLOCKED",
      reason: "Computer workspace is restricted to owner/admin roles.",
    };
  }

  // Check against policy rules in order
  for (const rule of POLICY_RULES) {
    if (rule.matches(ctx)) {
      return {
        decision: rule.decision,
        reason: rule.reason,
      };
    }
  }

  // Default: require approval for anything not explicitly allowed
  return {
    decision: "REQUIRES_APPROVAL",
    reason: "Action not explicitly permitted requires approval.",
  };
}

/**
 * Check if an action is allowed (AUTO_APPROVED).
 */
export function isAllowed(ctx: PolicyContext): boolean {
  return evaluatePolicy(ctx).decision === "AUTO_APPROVED";
}

/**
 * Check if an action is blocked.
 */
export function isBlocked(ctx: PolicyContext): boolean {
  return evaluatePolicy(ctx).decision === "BLOCKED";
}
