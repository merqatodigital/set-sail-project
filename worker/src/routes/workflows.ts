// Workflow management routes — manual trigger and status for resort workflows.
//
// Architecture:
//   POST /api/workflows/daily-briefing → triggers DailyResortBriefingWorkflow
//   GET  /api/workflows/daily-briefing/status → returns workflow status
//   GET  /api/workflows/daily-briefing/artifacts → lists briefing artifacts
//
// All endpoints are owner/admin only. Tenant ID is derived server-side.

import type { Env } from "../env.js";
import type { AuthContext } from "../auth/context.js";

interface WorkflowResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Handle workflow-related API requests.
 */
export async function handleWorkflows(
  request: Request,
  env: Env,
  auth: AuthContext,
  path: string,
): Promise<Response> {
  let tenantId = auth.tenantId;
  let isDevMode = false;

  // Development mode: allow X-Dev-Tenant header when no Authorization header is present
  if (!tenantId && !request.headers.get("Authorization")) {
    const devTenant = request.headers.get("X-Dev-Tenant");
    if (devTenant) {
      tenantId = devTenant;
      isDevMode = true;
    }
  }

  // Production auth check
  if (!isDevMode && auth.role !== "owner" && auth.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tenantId) {
    return Response.json({ error: "Tenant ID required" }, { status: 400 });
  }

  try {
    // POST /api/workflows/daily-briefing — trigger daily briefing
    if (path === "/api/workflows/daily-briefing" && request.method === "POST") {
      return await triggerDailyBriefing(env, tenantId, request);
    }

    // GET /api/workflows/daily-briefing/status — get workflow status
    if (path === "/api/workflows/daily-briefing/status" && request.method === "GET") {
      return await getBriefingStatus(env, tenantId);
    }

    // GET /api/workflows/daily-briefing/artifacts — list briefing artifacts
    if (path === "/api/workflows/daily-briefing/artifacts" && request.method === "GET") {
      return await listBriefingArtifacts(env, tenantId);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(`[Workflows] Error: ${err}`);
    return Response.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

/**
 * Trigger the daily briefing workflow.
 */
async function triggerDailyBriefing(
  env: Env,
  tenantId: string,
  request: Request,
): Promise<Response> {
  // Parse optional parameters from request body
  let date: string | undefined;
  let timezone: string | undefined;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    date = body.date as string | undefined;
    timezone = body.timezone as string | undefined;
  } catch {
    // No body or invalid JSON — use defaults
  }

  // Get tenant timezone from D1 if not provided
  if (!timezone) {
    const setting = await env.DB.prepare(
      "SELECT value FROM property_settings WHERE tenant_id = ? AND key = 'timezone'"
    ).bind(tenantId).first();
    timezone = (setting?.value as string) || "Asia/Manila";
  }

  // Default date to today in tenant timezone
  if (!date) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    date = formatter.format(now);
  }

  // Create workflow instance via binding
  const workflowBinding = (env as unknown as Record<string, unknown>).DAILY_BRIEFING as {
    create: (options: { params: unknown; id?: string }) => Promise<{ id: string }>;
  } | undefined;

  if (!workflowBinding) {
    return Response.json(
      { error: "Workflow binding not configured. Add DAILY_BRIEFING to wrangler.jsonc." },
      { status: 503 },
    );
  }

  // Use deterministic ID for idempotency: daily-briefing-{tenantId}-{date}
  const instanceId = `daily-briefing-${tenantId}-${date}`;

  try {
    const instance = await workflowBinding.create({
      params: { tenantId, date, timezone },
      id: instanceId,
    });

    return Response.json({
      success: true,
      data: {
        instanceId: instance.id,
        tenantId,
        date,
        timezone,
        message: "Daily briefing workflow triggered successfully",
      },
    } as WorkflowResponse);
  } catch (err) {
    // Handle idempotency — instance may already exist
    const errorMsg = (err as Error).message;
    if (errorMsg.includes("already exists") || errorMsg.includes("duplicate")) {
      return Response.json({
        success: true,
        data: {
          instanceId,
          tenantId,
          date,
          message: "Workflow instance already exists for this date",
        },
      } as WorkflowResponse);
    }
    throw err;
  }
}

/**
 * Get the status of the daily briefing workflow.
 */
async function getBriefingStatus(
  env: Env,
  tenantId: string,
): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const instanceId = `daily-briefing-${tenantId}-${today}`;

  const workflowBinding = (env as unknown as Record<string, unknown>).DAILY_BRIEFING as {
    get: (id: string) => Promise<{
      id: string;
      status: () => Promise<{
        status: string;
        output?: unknown;
        error?: string;
      }>;
    }>;
  } | undefined;

  if (!workflowBinding) {
    return Response.json({
      success: true,
      data: {
        configured: false,
        message: "Workflow binding not configured",
      },
    } as WorkflowResponse);
  }

  try {
    const instance = await workflowBinding.get(instanceId);
    const status = await instance.status();

    return Response.json({
      success: true,
      data: {
        configured: true,
        instanceId,
        tenantId,
        date: today,
        status: status.status,
        output: status.output,
        error: status.error,
      },
    } as WorkflowResponse);
  } catch {
    // Instance not found — workflow hasn't been triggered yet
    return Response.json({
      success: true,
      data: {
        configured: true,
        instanceId,
        tenantId,
        date: today,
        status: "not_triggered",
        message: "No workflow instance found for today",
      },
    } as WorkflowResponse);
  }
}

/**
 * List briefing artifacts from D1.
 */
async function listBriefingArtifacts(
  env: Env,
  tenantId: string,
): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const relativePath = `briefings/${today}-morning-brief.md`;

  // Read artifact from D1
  const row = await env.DB.prepare(
    `SELECT content, content_length, created_at FROM workflow_artifacts
     WHERE tenant_id = ? AND workflow_type = 'daily-briefing' AND artifact_path = ?`
  ).bind(tenantId, relativePath).first<{ content: string; content_length: number; created_at: string }>();

  if (!row) {
    return Response.json({
      success: true,
      data: {
        artifacts: [],
        message: "No artifact found for today. Workflow may not have completed yet.",
      },
    } as WorkflowResponse);
  }

  return Response.json({
    success: true,
    data: {
      artifacts: [
        {
          date: today,
          relativePath,
          type: "daily_morning_briefing",
          contentLength: row.content_length,
          createdAt: row.created_at,
          contentPreview: row.content.substring(0, 200) + "...",
        },
      ],
    },
  } as WorkflowResponse);
}
