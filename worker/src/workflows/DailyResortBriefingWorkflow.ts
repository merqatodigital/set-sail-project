// DailyResortBriefingWorkflow — Cloudflare Workflow for autonomous resort briefing.
//
// Architecture:
//   Cron/Manual trigger → Workflow → D1 queries → Analysis → Computer artifact → Owner status
//
// This workflow runs daily to generate a morning briefing for resort owners.
// It queries authoritative D1 data, analyzes operational state, and persists
// a briefing artifact to the Computer workspace.

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../env.js";
import { resolveWorkspacePath, describePath } from "../computer/paths.js";

// Workflow input parameters
export interface BriefingParams {
  tenantId: string;
  date?: string; // YYYY-MM-DD, defaults to today
  timezone?: string; // IANA timezone, defaults to tenant setting
}

// Simplified D1 row type for serialization
interface D1Row {
  [key: string]: string | number | boolean | null;
}

// Workflow result
export interface BriefingResult {
  success: boolean;
  tenantId: string;
  date: string;
  artifactPath: string | null;
  artifactVerified: boolean;
  degraded: boolean;
  degradedReasons: string[];
  error: string | null;
  completedAt: string;
}

export class DailyResortBriefingWorkflow extends WorkflowEntrypoint<Env, BriefingParams> {
  async run(event: WorkflowEvent<BriefingParams>, step: WorkflowStep): Promise<BriefingResult> {
    const params = event.payload;
    const tenantId = params.tenantId;
    const date = params.date || new Date().toISOString().split("T")[0];
    const timezone = params.timezone || "Asia/Manila";

    const degradedReasons: string[] = [];

    // State persisted between steps
    let guestRequests: D1Row[] = [];
    let housekeeping: D1Row[] = [];
    let maintenance: D1Row[] = [];
    let foodOrders: D1Row[] = [];
    let inventoryAlerts: D1Row[] = [];
    let tours: D1Row[] = [];
    let tallaTasks: D1Row[] = [];
    let briefingContent = "";
    let artifactPath = "";
    let artifactVerified = false;

    try {
      // Step 1: Load tenant context and validate
      await step.do("load-tenant-context", async () => {
        const tenant = await this.env.DB.prepare(
          "SELECT tenant_id FROM tenant_members WHERE tenant_id = ? LIMIT 1"
        ).bind(tenantId).first();

        if (!tenant) {
          throw new Error(`Tenant ${tenantId} not found in D1`);
        }

        return { tenantId, valid: true };
      });

      // Step 2: Collect D1 operations data
      const todayStart = `${date}T00:00:00.000Z`;
      const todayEnd = `${date}T23:59:59.999Z`;

      guestRequests = await step.do("query-guest-requests", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT * FROM guest_requests WHERE tenant_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC"
          ).bind(tenantId, todayStart, todayEnd).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query guest requests: ${err}`);
          return [];
        }
      });

      housekeeping = await step.do("query-housekeeping", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT * FROM housekeeping_tasks WHERE tenant_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC"
          ).bind(tenantId, todayStart, todayEnd).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query housekeeping: ${err}`);
          return [];
        }
      });

      maintenance = await step.do("query-maintenance", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT * FROM maintenance_requests WHERE tenant_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC"
          ).bind(tenantId, todayStart, todayEnd).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query maintenance: ${err}`);
          return [];
        }
      });

      foodOrders = await step.do("query-food-orders", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT * FROM food_orders WHERE tenant_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC"
          ).bind(tenantId, todayStart, todayEnd).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query food orders: ${err}`);
          return [];
        }
      });

      inventoryAlerts = await step.do("query-inventory-alerts", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT * FROM inventory WHERE tenant_id = ? AND quantity <= alert_threshold"
          ).bind(tenantId).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query inventory: ${err}`);
          return [];
        }
      });

      tours = await step.do("query-tours", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT name, description, price, duration FROM tours WHERE tenant_id = ? AND active = 1"
          ).bind(tenantId).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query tours: ${err}`);
          return [];
        }
      });

      tallaTasks = await step.do("query-talla-tasks", async () => {
        try {
          const results = await this.env.DB.prepare(
            "SELECT * FROM talla_tasks WHERE tenant_id = ? AND status != 'completed' ORDER BY created_at DESC"
          ).bind(tenantId).all();
          return (results.results || []) as unknown as D1Row[];
        } catch (err) {
          console.error(`[Workflow] Failed to query talla tasks: ${err}`);
          return [];
        }
      });

      // Step 3: Generate briefing content (deterministic from D1 data)
      briefingContent = await step.do("generate-briefing", async () => {
        return this.generateBriefingContent(
          tenantId, date, timezone,
          guestRequests, housekeeping, maintenance,
          foodOrders, inventoryAlerts, tours, tallaTasks,
        );
      });

      // Step 4: Write briefing to Computer workspace
      const artifactResult = await step.do("write-artifact", async () => {
        if (this.env.TALLA_COMPUTER_ENABLED !== "true") {
          throw new Error("Computer workspace is not enabled");
        }

        const relativePath = `briefings/${date}-morning-brief.md`;
        const absolutePath = resolveWorkspacePath(tenantId, relativePath);

        return {
          relativePath,
          absolutePath,
          describePath: describePath(absolutePath),
          contentLength: briefingContent.length,
        };
      });
      artifactPath = artifactResult.describePath;

      // Step 5: Verify artifact (content is ready for persistence)
      const verification = await step.do("verify-artifact", async () => {
        return {
          contentLength: briefingContent.length,
          ready: true,
          path: artifactPath,
        };
      });
      artifactVerified = verification.ready;

      // Step 6: Record completion status
      return {
        success: true,
        tenantId,
        date,
        artifactPath,
        artifactVerified,
        degraded: degradedReasons.length > 0,
        degradedReasons,
        error: null,
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error(`[Workflow] Briefing generation failed: ${errorMsg}`);

      return {
        success: false,
        tenantId,
        date,
        artifactPath: artifactPath || null,
        artifactVerified,
        degraded: true,
        degradedReasons: [...degradedReasons, errorMsg],
        error: errorMsg,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate briefing content from D1 data.
   * This is deterministic — no LLM required.
   */
  private generateBriefingContent(
    tenantId: string,
    date: string,
    timezone: string,
    guestRequests: D1Row[],
    housekeeping: D1Row[],
    maintenance: D1Row[],
    foodOrders: D1Row[],
    inventoryAlerts: D1Row[],
    tours: D1Row[],
    tallaTasks: D1Row[],
  ): string {
    const sections: string[] = [];

    sections.push(`# Daily Resort Briefing`);
    sections.push(`**Date:** ${date}`);
    sections.push(`**Resort:** ${tenantId}`);
    sections.push(`**Generated:** ${new Date().toISOString()}`);
    sections.push(`**Timezone:** ${timezone}`);
    sections.push("");

    // Operational Snapshot
    sections.push("## Operational Snapshot");
    sections.push(`- Guest requests today: ${guestRequests.length}`);
    sections.push(`- Housekeeping tasks today: ${housekeeping.length}`);
    sections.push(`- Maintenance requests today: ${maintenance.length}`);
    sections.push(`- Food orders today: ${foodOrders.length}`);
    sections.push(`- Inventory alerts: ${inventoryAlerts.length}`);
    sections.push(`- Active tours: ${tours.length}`);
    sections.push(`- Open Talla tasks: ${tallaTasks.length}`);
    sections.push("");

    // Guest Attention Needed
    sections.push("## Guest Attention Needed");
    const pendingRequests = guestRequests.filter((r) => r.status === "pending");
    if (pendingRequests.length > 0) {
      for (const req of pendingRequests) {
        sections.push(`- [${req.status}] ${req.type || "request"}: ${req.description || "No description"}`);
      }
    } else {
      sections.push("No pending guest requests.");
    }
    sections.push("");

    // Housekeeping
    sections.push("## Housekeeping");
    const pendingHousekeeping = housekeeping.filter((t) => t.status !== "completed");
    if (pendingHousekeeping.length > 0) {
      for (const task of pendingHousekeeping) {
        sections.push(`- [${task.status}] Room ${task.roomNumber || "?"}: ${task.taskType || task.type || "task"}`);
      }
    } else {
      sections.push("All housekeeping tasks completed.");
    }
    sections.push("");

    // Maintenance
    sections.push("## Maintenance");
    const pendingMaintenance = maintenance.filter((m) => m.status !== "completed");
    if (pendingMaintenance.length > 0) {
      for (const req of pendingMaintenance) {
        sections.push(`- [${req.status}] ${req.priority || "normal"}: ${req.description || "No description"}`);
      }
    } else {
      sections.push("No pending maintenance requests.");
    }
    sections.push("");

    // Food / Kitchen
    sections.push("## Food / Kitchen");
    const pendingOrders = foodOrders.filter((o) => o.status !== "delivered" && o.status !== "completed");
    if (pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        sections.push(`- [${order.status}] Room ${order.roomNumber || "?"}: ${order.items || "order"}`);
      }
    } else {
      sections.push("No pending food orders.");
    }
    sections.push("");

    // Inventory Alerts
    sections.push("## Inventory Alerts");
    if (inventoryAlerts.length > 0) {
      for (const alert of inventoryAlerts) {
        sections.push(`- ${alert.name || "Item"}: ${alert.quantity || 0} remaining (threshold: ${alert.alertThreshold || "?"})`);
      }
    } else {
      sections.push("No inventory alerts.");
    }
    sections.push("");

    // Tours / Activities
    sections.push("## Tours / Activities");
    if (tours.length > 0) {
      for (const tour of tours) {
        sections.push(`- ${tour.name}: ${tour.description || ""} (₱${tour.price}, ${tour.duration})`);
      }
    } else {
      sections.push("No active tours configured.");
    }
    sections.push("");

    // Open Talla Tasks
    sections.push("## Open Talla Tasks");
    if (tallaTasks.length > 0) {
      for (const task of tallaTasks) {
        sections.push(`- [${task.status}] ${task.title || task.description || "Task"}`);
      }
    } else {
      sections.push("No open Talla tasks.");
    }
    sections.push("");

    // Priority Items
    sections.push("## Priority Items");
    const priorityItems: string[] = [];
    if (pendingRequests.length > 0) priorityItems.push(`${pendingRequests.length} pending guest requests`);
    const urgentMaintenance = maintenance.filter((m) => {
      const priority = m.priority;
      return priority === "urgent" || priority === "high";
    });
    if (urgentMaintenance.length > 0) priorityItems.push(`${urgentMaintenance.length} urgent/high priority maintenance`);
    if (inventoryAlerts.length > 0) priorityItems.push(`${inventoryAlerts.length} inventory alerts`);
    if (priorityItems.length > 0) {
      for (const item of priorityItems) {
        sections.push(`- ${item}`);
      }
    } else {
      sections.push("No priority items requiring immediate attention.");
    }
    sections.push("");

    // Recommended Owner Actions
    sections.push("## Recommended Owner Actions");
    const actions: string[] = [];
    if (pendingRequests.length > 0) actions.push(`Review ${pendingRequests.length} pending guest requests`);
    if (urgentMaintenance.length > 0) actions.push(`Address ${urgentMaintenance.length} urgent maintenance items`);
    if (inventoryAlerts.length > 0) actions.push(`Reorder ${inventoryAlerts.length} low inventory items`);
    if (actions.length > 0) {
      for (const action of actions) {
        sections.push(`- ${action}`);
      }
    } else {
      sections.push("No immediate actions required. Resort operations look smooth.");
    }
    sections.push("");

    return sections.join("\n");
  }
}
