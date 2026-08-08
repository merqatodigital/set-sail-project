// Housekeeping tools — creates housekeeping tasks via Phase 4 repo.

import type { TallaTool } from "../types.js";
import { createHousekeepingTask } from "../../db/repos/housekeepingRepo.js";

export const createHousekeepingTaskTool: TallaTool = {
  name: "createHousekeepingTask",
  description:
    "Create a housekeeping task for room cleaning, laundry, inspection, or other housekeeping needs. Use this when a guest requests towels, cleaning, room service, or when staff need housekeeping assistance.",
  parameters: {
    type: "object",
    properties: {
      room: {
        type: "string",
        description: "The room or location (e.g. 'Cabana 3', 'Room 101')",
      },
      area: {
        type: "string",
        description: "Optional area within the room/location",
      },
      taskType: {
        type: "string",
        enum: ["cleaning", "laundry", "maintenance", "inspection", "other"],
        description: "Type of housekeeping task (defaults to 'cleaning')",
      },
      priority: {
        type: "string",
        enum: ["low", "normal", "high", "urgent"],
        description: "Priority level (defaults to 'normal')",
      },
      notes: {
        type: "string",
        description: "Additional details about the task (optional)",
      },
    },
    required: ["room"],
  },
  execute: async (args, ctx) => {
    try {
      const task = await createHousekeepingTask(ctx.db, ctx.tenantId, {
        room: args.room as string,
        area: (args.area as string) || "",
        taskType: (args.taskType as string) || "cleaning",
        priority: (args.priority as string) || "normal",
        notes: (args.notes as string) || "",
      });

      return {
        success: true,
        data: {
          id: task.id,
          room: task.room,
          taskType: task.taskType,
          status: task.status,
          message: `Housekeeping task created for ${task.room}. Task ID: ${task.id}`,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
