// TallaAgent types — shared types for the agent system.

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
