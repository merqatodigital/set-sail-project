// TallaAgent Durable Object — the real Cloudflare Talla resort agent.
//
// Architecture:
//   Browser/DO ← WebSocket ← TallaAgent
//   TallaAgent → OpenRouter LLM → tool calls
//   TallaAgent → Phase 4 repos → D1
//   TallaAgent → Computer Workspace → files/artifacts
//   TallaAgent → response → Browser/DO
//
// This is the main agent module. It handles:
// - Conversation state (bounded history in DO SQLite)
// - LLM reasoning via OpenRouter
// - Tool execution via shared Phase 4 repos
// - Computer workspace operations (Phase 6)
// - Authorization (guest vs owner)
// - Tool audit logging

import { Agent, callable } from "agents";
import { Workspace, type DurableObjectStorageLike } from "@cloudflare/computer";
import { WorkerJavaScriptBackend } from "@cloudflare/computer/backends/worker-javascript";
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

// Computer adapter
import { resolveWorkspacePath, describePath } from "../computer/paths.js";
import { evaluatePolicy } from "../computer/policy.js";

// Import repos for system prompt context
import { getAllSettings } from "../db/repos/propertySettingsRepo.js";
import { listActiveTours } from "../db/repos/toursRepo.js";
import { listMenuItems } from "../db/repos/menuRepo.js";

const MAX_HISTORY = 20; // bounded conversation history
const MAX_TOOL_HOPS = 5; // max tool-calling iterations

// Computer tool names — intercepted and executed via workspace
const COMPUTER_TOOL_NAMES = new Set([
  "workspaceList",
  "workspaceRead",
  "workspaceWrite",
  "workspaceSearch",
]);

export class TallaAgent extends Agent<Env, TallaAgentState> {
  // Computer workspace — one per DO instance (tenant-isolated)
  private workspace: Workspace | null = null;
  private computerEnabled = false;

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

    // Initialize Computer workspace if enabled
    this.computerEnabled = this.env.TALLA_COMPUTER_ENABLED === "true";
    if (this.computerEnabled && !this.workspace) {
      try {
        const backend = new WorkerJavaScriptBackend({
          loader: this.env.LOADER,
        });
        this.workspace = new Workspace({
          storage: this.ctx.storage as unknown as DurableObjectStorageLike,
          backends: [backend],
        });
        await this.workspace.ready();
        console.log(`[TallaAgent] Computer workspace initialized for tenant: ${this.state.tenantId}`);
      } catch (err) {
        console.error("[TallaAgent] Failed to initialize Computer workspace:", err);
        this.workspace = null;
        this.computerEnabled = false;
      }
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
        version: "phase6",
        resortId: this.state.resortId,
        tenantId: this.state.tenantId,
        initialized: this.state.initialized,
        conversationCount: this.state.conversationCount,
        computer: {
          enabled: this.computerEnabled,
          connected: this.workspace !== null,
        },
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
    const tools = getTools(this.state.role, this.computerEnabled);
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

        let toolResult;
        if (COMPUTER_TOOL_NAMES.has(tc.name) && this.computerEnabled && this.workspace) {
          // Computer tool — execute via workspace
          toolResult = await audit(tc.name, () =>
            this.executeComputerTool(tc.name, args, toolCtx),
          );
        } else {
          // D1 resort tool — execute via tool registry
          toolResult = await audit(tc.name, () => executeTool(tc.name, args, toolCtx));
        }

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
        computerEnabled: this.computerEnabled,
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
        computerEnabled: this.computerEnabled,
      });
    }
  }

  // ---- Callable methods for direct access ----

  @callable()
  health(): { status: string; resortId: string; version: string } {
    return {
      status: "healthy",
      resortId: this.state.resortId,
      version: "phase6",
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

  // ---- Computer workspace tool execution ----

  /**
   * Execute a Computer tool via the workspace.
   * This method handles the actual filesystem operations.
   */
  private async executeComputerTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.workspace) {
      return { success: false, error: "Computer workspace is not available" };
    }

    // Enforce role authorization
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return { success: false, error: "Computer workspace is restricted to owner/admin roles." };
    }

    try {
      switch (toolName) {
        case "workspaceList":
          return await this.handleWorkspaceList(args, ctx);
        case "workspaceRead":
          return await this.handleWorkspaceRead(args, ctx);
        case "workspaceWrite":
          return await this.handleWorkspaceWrite(args, ctx);
        case "workspaceSearch":
          return await this.handleWorkspaceSearch(args, ctx);
        default:
          return { success: false, error: `Unknown Computer tool: ${toolName}` };
      }
    } catch (err) {
      console.error(`[TallaAgent] Computer tool error (${toolName}):`, err);
      return {
        success: false,
        error: `Workspace operation failed: ${(err as Error).message}`,
      };
    }
  }

  private async handleWorkspaceList(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const relativePath = (args.path as string) || "/";
    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    // Policy check
    const policy = evaluatePolicy({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      action: "list",
      path: absolutePath,
    });
    if (policy.decision === "BLOCKED") {
      return { success: false, error: `Access denied: ${policy.reason}` };
    }
    if (policy.decision === "REQUIRES_APPROVAL") {
      return { success: false, error: `Requires approval: ${policy.reason}` };
    }

    // Execute via workspace
    const entries = await this.workspace!.fs.readdir(absolutePath);
    const files = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory,
    }));

    return {
      success: true,
      data: {
        path: describePath(absolutePath),
        contents: files,
      },
    };
  }

  private async handleWorkspaceRead(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const relativePath = args.path as string;
    if (!relativePath) {
      return { success: false, error: "Path is required" };
    }

    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    // Policy check
    const policy = evaluatePolicy({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      action: "read",
      path: absolutePath,
    });
    if (policy.decision === "BLOCKED") {
      return { success: false, error: `Access denied: ${policy.reason}` };
    }

    // Execute via workspace
    const content = await this.workspace!.fs.readFile(absolutePath, "utf8");

    return {
      success: true,
      data: {
        path: describePath(absolutePath),
        content,
        size: content.length,
      },
    };
  }

  private async handleWorkspaceWrite(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const relativePath = args.path as string;
    const content = args.content as string;

    if (!relativePath || !content) {
      return { success: false, error: "Path and content are required" };
    }

    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    // Policy check
    const policy = evaluatePolicy({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      action: "write",
      path: absolutePath,
    });
    if (policy.decision === "BLOCKED") {
      return { success: false, error: `Access denied: ${policy.reason}` };
    }
    if (policy.decision === "REQUIRES_APPROVAL") {
      return { success: false, error: `Requires approval: ${policy.reason}` };
    }

    // Execute via workspace
    await this.workspace!.fs.writeFile(absolutePath, content);

    // Verify the file was written
    const stat = await this.workspace!.fs.stat(absolutePath);

    return {
      success: true,
      data: {
        path: describePath(absolutePath),
        bytesWritten: content.length,
        verified: stat.size === content.length,
      },
    };
  }

  private async handleWorkspaceSearch(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const pattern = args.pattern as string;
    const relativePath = (args.path as string) || "/";

    if (!pattern) {
      return { success: false, error: "Search pattern is required" };
    }

    const absolutePath = resolveWorkspacePath(ctx.tenantId, relativePath);

    // Policy check
    const policy = evaluatePolicy({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      action: "search",
      path: absolutePath,
    });
    if (policy.decision === "BLOCKED") {
      return { success: false, error: `Access denied: ${policy.reason}` };
    }

    // Execute via workspace
    const hits = await this.workspace!.fs.grep(pattern, absolutePath, {
      ignoreCase: true,
    });

    return {
      success: true,
      data: {
        pattern,
        path: describePath(absolutePath),
        matches: hits.map((hit) => ({
          path: hit.path,
          line: hit.line,
          text: hit.text,
        })),
      },
    };
  }
}
