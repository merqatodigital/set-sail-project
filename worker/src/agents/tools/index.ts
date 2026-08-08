// Tool definitions and registry for TallaAgent.
// Each tool defines its schema and execution function.
// Tools reuse Phase 4 repositories — no duplicate business logic.

import type { TallaTool, ToolContext, ToolResult } from "../types.js";

// Import tools
import { getPropertyInfoTool } from "./propertyTools.js";
import { getToursTool } from "./tourTools.js";
import { getMenuTool } from "./menuTools.js";
import { createGuestRequestTool } from "./guestRequestTools.js";
import { createHousekeepingTaskTool } from "./housekeepingTools.js";
import { createMaintenanceRequestTool } from "./maintenanceTools.js";
import { createFoodOrderTool } from "./orderTools.js";
import { getInventoryTool } from "./inventoryTools.js";
import { getTodayOperationsTool } from "./operationsTools.js";

/**
 * Get all available tools for the current context.
 * Owner/admin gets more tools than guest.
 */
export function getTools(role: string | null): TallaTool[] {
  const isOwner = role === "owner" || role === "admin";

  const tools: TallaTool[] = [
    // Read tools — available to everyone
    getPropertyInfoTool,
    getToursTool,
    getMenuTool,
    getInventoryTool,

    // Write tools — available to authenticated users
    createGuestRequestTool,
    createHousekeepingTaskTool,
    createMaintenanceRequestTool,
    createFoodOrderTool,
  ];

  // Owner-only tools
  if (isOwner) {
    tools.push(getTodayOperationsTool);
  }

  return tools;
}

/**
 * Convert TallaTools to OpenRouter function-calling format.
 */
export function toOpenRouterTools(tools: TallaTool[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}> {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Execute a tool by name.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tools = getTools(ctx.role);
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  return tool.execute(args, ctx);
}
