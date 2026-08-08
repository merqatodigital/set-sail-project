// TallaAgent Durable Object — the real Cloudflare Talla resort agent.
//
// Architecture:
//   Browser/DO ← WebSocket ← TallaAgent
//   TallaAgent → OpenRouter LLM → tool calls
//   TallaAgent → Phase 4 repos → D1
//   TallaAgent → response → Browser/DO
//
// This is the main agent module. It handles:
// - Conversation state (bounded history in DO SQLite)
// - LLM reasoning via OpenRouter
// - Tool execution via shared Phase 4 repos
// - Authorization (guest vs owner)
// - Tool audit logging

import { Agent, callable } from "agents";
import type { Env } from "../env.js";
import {
  chatCompletion,
  type ChatResponse,
} from "./provider.js";
import { buildSystemPrompt, type SystemPromptContext } from "./systemPrompt.js";
import { getTools, toOpenRouterTools, executeTool } from "./tools/index.js";
import { createAuditWrapper } from "./toolAudit.js";
import type {
  TallaAgentState,
  ConversationMessage,
  ToolContext,
} from "./types.js";

// Import repos for system prompt context
import { getAllSettings } from "../db/repos/propertySettingsRepo.js";
import { listActiveTours } from "../db/repos/toursRepo.js";
import { listMenuItems } from "../db/repos/menuRepo.js";

const MAX_HISTORY = 20; // bounded conversation history
const MAX_TOOL_HOPS = 5; // max tool-calling iterations

export class TallaAgent extends Agent<Env, TallaAgentState> {
  initialState: TallaAgentState = {
    resortId: "marina_terrace",
    tenantId: "",
    userId: null,
    role: null,
    sessionId: "",
    initialized: false,
    lastInteractionAt: null,
    conversationCount: 0,
    messages: [],
    guestName: null,
    guestRoom: null,
  };

  async onStart(): Promise<void> {
    if (!this.state.initialized) {
      this.setState({
        ...this.state,
        initialized: true,
        sessionId: crypto.randomUUID(),
        lastInteractionAt: new Date().toISOString(),
      });
    }
  }

  async onConnect(_connection: unknown, _ctx: unknown): Promise<void> {
    console.log(`[TallaAgent] onConnect — session: ${this.state.sessionId}`);
  }

  async onMessage(_connection: unknown, rawMessage: unknown): Promise<void> {
    const message = rawMessage as string;
    if (!message) return;

    try {
      const parsed = JSON.parse(message) as {
        type: string;
        content?: string;
        tenantId?: string;
        userId?: string;
        role?: string;
        guestName?: string;
        guestRoom?: string;
      };

      // Handle initialization message
      if (parsed.type === "init") {
        this.setState({
          ...this.state,
          tenantId: parsed.tenantId || this.state.tenantId,
          userId: parsed.userId || this.state.userId,
          role: parsed.role || this.state.role,
          guestName: parsed.guestName || this.state.guestName,
          guestRoom: parsed.guestRoom || this.state.guestRoom,
        });
        this.broadcast(JSON.stringify({ type: "ready", sessionId: this.state.sessionId }));
        return;
      }

      // Handle chat message
      if (parsed.type === "chat" && parsed.content) {
        const response = await this.handleChat(parsed.content);
        this.broadcast(
          JSON.stringify({
            type: "response",
            content: response.content,
            toolCalls: response.toolCalls,
            model: response.model,
            usage: response.usage,
          }),
        );
      }
    } catch (err) {
      console.error("[TallaAgent] Message handling error:", err);
      this.broadcast(
        JSON.stringify({
          type: "error",
          error: "I encountered an error processing your message. Please try again.",
        }),
      );
    }
  }

  async onClose(
    _connection: unknown,
    _code: unknown,
    _reason: unknown,
    _wasClean: unknown,
  ): Promise<void> {
    console.log(`[TallaAgent] onClose — session: ${this.state.sessionId}`);
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        agent: "TallaAgent",
        version: "phase5",
        resortId: this.state.resortId,
        tenantId: this.state.tenantId,
        initialized: this.state.initialized,
        conversationCount: this.state.conversationCount,
      });
    }

    // HTTP chat endpoint (for non-WebSocket clients)
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          content: string;
          tenantId?: string;
          userId?: string;
          role?: string;
        };

        if (body.tenantId) {
          this.setState({
            ...this.state,
            tenantId: body.tenantId,
            userId: body.userId || this.state.userId,
            role: body.role || this.state.role,
          });
        }

        const response = await this.handleChat(body.content);
        return Response.json(response);
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 500 });
      }
    }

    return new Response("TallaAgent — Phase 5", { status: 200 });
  }

  /**
   * Main chat handling — sends to LLM, executes tools, returns response.
   */
  private async handleChat(userMessage: string): Promise<ChatResponse> {
    const apiKey = this.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        content: "Talla is not configured yet. The OPENROUTER_API_KEY is missing.",
        toolCalls: [],
        finishReason: "error",
        model: "none",
      };
    }

    // Update state
    this.setState({
      ...this.state,
      lastInteractionAt: new Date().toISOString(),
      conversationCount: this.state.conversationCount + 1,
    });

    // Build tool context
    const toolCtx: ToolContext = {
      tenantId: this.state.tenantId,
      userId: this.state.userId,
      role: this.state.role,
      db: this.env.DB,
    };

    // Build system prompt with live D1 data
    const systemPrompt = await this.buildLiveSystemPrompt(toolCtx);

    // Add user message to history
    const userMsg: ConversationMessage = { role: "user", content: userMessage };
    const messages = [...this.state.messages, userMsg];

    // Get tools for current role
    const tools = getTools(this.state.role);
    const orTools = toOpenRouterTools(tools);

    // Tool-calling loop
    let finalResponse: ChatResponse | null = null;
    const audit = createAuditWrapper(
      this.env.DB,
      this.state.tenantId,
      this.state.userId,
      this.state.sessionId,
    );

    for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
      // Build wire messages
      const wire: ConversationMessage[] = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-MAX_HISTORY),
      ];

      // Call LLM
      const response = await chatCompletion(apiKey, {
        messages: wire,
        tools: orTools,
      });

      // If no tool calls, we're done
      if (response.toolCalls.length === 0) {
        finalResponse = response;
        break;
      }

      // Add assistant message with tool calls to history
      const assistantMsg: ConversationMessage = {
        role: "assistant",
        content: response.content ?? "",
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantMsg);

      // Execute all tool calls
      for (const tc of response.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          // Invalid JSON arguments
        }

        const toolResult = await audit(tc.name, () => executeTool(tc.name, args, toolCtx));

        // Add tool result to history
        const toolMsg: ConversationMessage = {
          role: "tool",
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
          name: tc.name,
        };
        messages.push(toolMsg);
      }

      // Continue loop — LLM will process tool results
      finalResponse = response;
    }

    // If we exhausted tool hops without a final response
    if (!finalResponse) {
      finalResponse = {
        content: "I wasn't able to complete that request. Please try again.",
        toolCalls: [],
        finishReason: "max_hops",
        model: "none",
      };
    }

    // Add assistant response to history
    if (finalResponse.content) {
      messages.push({ role: "assistant", content: finalResponse.content });
    }

    // Trim and save history
    const trimmedMessages = messages.slice(-MAX_HISTORY);
    this.setState({ ...this.state, messages: trimmedMessages });

    return finalResponse;
  }

  /**
   * Build system prompt with live D1 data for the current tenant.
   */
  private async buildLiveSystemPrompt(ctx: ToolContext): Promise<string> {
    try {
      const [settings, tours, menuItems] = await Promise.all([
        getAllSettings(ctx.db, ctx.tenantId),
        listActiveTours(ctx.db, ctx.tenantId),
        listMenuItems(ctx.db, ctx.tenantId, { activeOnly: true }),
      ]);

      // Convert settings to key-value record
      const propertyInfo: Record<string, string> = {};
      for (const s of settings) {
        propertyInfo[s.key] = s.value;
      }

      const promptCtx: SystemPromptContext = {
        tenantId: ctx.tenantId,
        role: ctx.role,
        guestName: this.state.guestName,
        guestRoom: this.state.guestRoom,
        propertyInfo,
        tours: tours.map((t) => ({
          name: t.name,
          description: t.description,
          price: t.price,
          duration: t.duration,
        })),
        menuItems: menuItems.map((m) => ({
          name: m.name,
          category: m.category,
          price: m.price,
          inventoryCount: m.inventoryCount,
        })),
      };

      return buildSystemPrompt(promptCtx);
    } catch (err) {
      console.error("[TallaAgent] Failed to build system prompt:", err);
      return buildSystemPrompt({
        tenantId: ctx.tenantId,
        role: ctx.role,
        guestName: this.state.guestName,
        guestRoom: this.state.guestRoom,
        propertyInfo: {},
        tours: [],
        menuItems: [],
      });
    }
  }

  // ---- Callable methods for direct access ----

  @callable()
  health(): { status: string; resortId: string; version: string } {
    return {
      status: "healthy",
      resortId: this.state.resortId,
      version: "phase5",
    };
  }

  @callable()
  getState(): TallaAgentState {
    return { ...this.state };
  }

  @callable()
  reset(): void {
    this.setState({
      ...this.state,
      messages: [],
      conversationCount: 0,
      guestName: null,
      guestRoom: null,
    });
  }
}
