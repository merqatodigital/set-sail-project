// Today operations tool — aggregated operational snapshot for owner/admin.
// Reads from multiple Phase 4 repos to provide a concise daily briefing.

import type { TallaTool } from "../types.js";
import { listGuestRequests } from "../../db/repos/guestRequestRepo.js";
import { listHousekeepingTasks } from "../../db/repos/housekeepingRepo.js";
import { listMaintenanceRequests } from "../../db/repos/maintenanceRepo.js";
import { listOrders } from "../../db/repos/foodOrderRepo.js";
import { listInventory } from "../../db/repos/inventoryRepo.js";
import { listTasks } from "../../db/repos/tallaOpsRepo.js";

export const getTodayOperationsTool: TallaTool = {
  name: "getTodayOperations",
  description:
    "Get a summary of today's resort operations including pending requests, housekeeping tasks, maintenance issues, food orders, inventory alerts, and pending tasks. Use this when the owner or admin asks what needs attention today. OWNER/ADMIN ONLY.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (_args, ctx) => {
    try {
      // Fetch all operational data in parallel
      const [
        guestRequests,
        housekeepingTasks,
        maintenanceRequests,
        foodOrders,
        lowStockItems,
        pendingTasks,
      ] = await Promise.all([
        listGuestRequests(ctx.db, ctx.tenantId, { status: "pending" }),
        listHousekeepingTasks(ctx.db, ctx.tenantId, { status: "pending" }),
        listMaintenanceRequests(ctx.db, ctx.tenantId, { status: "pending" }),
        listOrders(ctx.db, ctx.tenantId, { status: "pending" }),
        listInventory(ctx.db, ctx.tenantId, { lowStock: true }),
        listTasks(ctx.db, ctx.tenantId, { status: "pending" }),
      ]);

      return {
        success: true,
        data: {
          summary: {
            pendingGuestRequests: guestRequests.length,
            pendingHousekeeping: housekeepingTasks.length,
            pendingMaintenance: maintenanceRequests.length,
            pendingFoodOrders: foodOrders.length,
            lowStockAlerts: lowStockItems.length,
            pendingTasks: pendingTasks.length,
          },
          guestRequests: guestRequests.slice(0, 10).map((r) => ({
            id: r.id,
            type: r.type,
            guestName: r.guestName,
            status: r.status,
            createdAt: r.createdAt,
          })),
          housekeepingTasks: housekeepingTasks.slice(0, 10).map((t) => ({
            id: t.id,
            room: t.room,
            taskType: t.taskType,
            priority: t.priority,
            status: t.status,
          })),
          maintenanceRequests: maintenanceRequests.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title,
            location: r.location,
            priority: r.priority,
            status: r.status,
          })),
          foodOrders: foodOrders.slice(0, 10).map((o) => ({
            id: o.id,
            reference: o.reference,
            guestName: o.guestName,
            total: o.total,
            status: o.status,
          })),
          lowStockAlerts: lowStockItems.slice(0, 10).map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            reorderThreshold: i.reorderThreshold,
          })),
          pendingTasks: pendingTasks.slice(0, 10).map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            due: t.due,
          })),
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
