// TallaAgent types — shared types for the agent system.

import type { Env } from "../env.js";

export interface TallaTool {
  name: string;
  description: string;
  parameters: unknown; // JSON Schema for OpenRouter
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  tenantId: string;
  userId: string | null;
  role: string | null;
  db: D1Database;
  env: Env;
  // Session guest identity (from agent state) — used for secure self-scope so
  // guest tools never trust an LLM-supplied name. Undefined for owner/admin.
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  bookingReference?: string | null;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface TallaAgentState {
  resortId: string;
  tenantId: string;
  userId: string | null;
  role: string | null;
  sessionId: string;
  initialized: boolean;
  lastInteractionAt: string | null;
  conversationCount: number;
  messages: ConversationMessage[];
  guestName: string | null;
  guestRoom: string | null;
  // Persisted guest identity from a completed booking/request, so later turns
  // reuse it (identity continuity) instead of re-asking. Never trust a raw
  // guest-supplied name for read scope — these are captured only after a
  // successful, server-validated write.
  guestPhone: string | null;
  guestEmail: string | null;
  bookingReference: string | null;
  // Stashed food order items quoted but not yet confirmed, so a later
  // affirmative ("yes") completes the write deterministically (no model loop).
  pendingFoodOrder: { menuItemId: string; quantity: number; specialInstructions?: string }[] | null;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ToolAuditEntry {
  requestId: string;
  tenantId: string;
  userId: string | null;
  sessionId: string;
  toolName: string;
  startTime: string;
  endTime: string;
  success: boolean;
  durationMs: number;
  safeResult?: string;
  error?: string;
}
