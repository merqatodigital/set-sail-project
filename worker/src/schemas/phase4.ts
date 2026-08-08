// Zod validation schemas for all Phase 4 operational domains.

import { z } from "zod";

// ---- Property Settings ----

export const UpsertSettingSchema = z.object({
  category: z.string().min(1).max(100).default("general"),
  key: z.string().min(1).max(200),
  value: z.string().max(10000),
});

export const UpsertSettingsBatchSchema = z.object({
  settings: z.array(UpsertSettingSchema).min(1).max(100),
});

// ---- Housekeeping ----

export const CreateHousekeepingTaskSchema = z.object({
  room: z.string().min(1, "Room is required").max(200),
  area: z.string().max(200).optional().default(""),
  taskType: z
    .enum(["cleaning", "laundry", "maintenance", "inspection", "other"], {
      message: "Invalid task type",
    })
    .optional()
    .default("cleaning"),
  priority: z
    .enum(["low", "normal", "high", "urgent"], {
      message: "Invalid priority",
    })
    .optional()
    .default("normal"),
  assignedTo: z.string().max(200).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

export const UpdateHousekeepingStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"], {
    message: "Invalid status",
  }),
});

// ---- Maintenance ----

export const CreateMaintenanceRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().default(""),
  location: z.string().max(200).optional().default(""),
  issueType: z
    .enum(["plumbing", "electrical", "structural", "furniture", "appliance", "other"], {
      message: "Invalid issue type",
    })
    .optional()
    .default("other"),
  priority: z
    .enum(["low", "normal", "high", "urgent"], {
      message: "Invalid priority",
    })
    .optional()
    .default("normal"),
  assignedTo: z.string().max(200).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

export const UpdateMaintenanceStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"], {
    message: "Invalid status",
  }),
});

// ---- Menu Items ----

export const CreateMenuItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional().default(""),
  category: z
    .enum(["breakfast", "lunch", "dinner", "drinks", "snacks", "dessert"], {
      message: "Invalid category",
    })
    .optional()
    .default("lunch"),
  price: z.number().min(0, "Price must be non-negative").max(10_000_000),
  foodCost: z.number().min(0).max(10_000_000).optional().default(0),
  inventoryCount: z.number().int().min(0).max(100_000).optional().default(0),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
});

export const UpdateMenuItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(["breakfast", "lunch", "dinner", "drinks", "snacks", "dessert"]).optional(),
  price: z.number().min(0).max(10_000_000).optional(),
  foodCost: z.number().min(0).max(10_000_000).optional(),
  inventoryCount: z.number().int().min(0).max(100_000).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

// ---- Food Orders ----

export const CreateFoodOrderSchema = z.object({
  guestName: z.string().min(1, "Guest name is required").max(200),
  guestPhone: z.string().max(50).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
        specialInstructions: z.string().max(500).optional(),
      }),
    )
    .min(1, "At least one item required")
    .max(50),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"], {
    message: "Invalid status",
  }),
});

// ---- Inventory ----

export const UpsertInventoryItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(200),
  category: z
    .enum(["linens", "towels", "bathroom", "food", "gas", "fuel", "cleaning", "other"], {
      message: "Invalid category",
    })
    .optional()
    .default("other"),
  unit: z.string().max(50).optional().default("pcs"),
  quantity: z.number().min(0).max(100_000),
  reorderThreshold: z.number().min(0).max(100_000).optional().default(0),
  unitCost: z.number().min(0).max(10_000_000).optional().default(0),
  notes: z.string().max(2000).optional().default(""),
});

export const AdjustInventorySchema = z.object({
  adjustment: z.number().int().min(-100_000).max(100_000),
});

// ---- Talla Tasks ----

export const CreateTalaTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  due: z.string().max(100).optional().default(""),
  category: z
    .enum(["general", "booking", "tour", "staff", "maintenance"], {
      message: "Invalid category",
    })
    .optional()
    .default("general"),
});

export const UpdateTalaTaskStatusSchema = z.object({
  status: z.enum(["pending", "done"], {
    message: "Invalid status",
  }),
});

// ---- Talla Leads ----

export const CreateTalaLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contact: z.string().max(200).optional().default(""),
  note: z.string().max(2000).optional().default(""),
  source: z.string().max(100).optional().default("talla_chat"),
  sourceUrl: z.string().max(500).optional().default(""),
});

// ---- Talla Goals ----

export const CreateTalaGoalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().default(""),
  targetDate: z.string().max(100).optional().default(""),
});

export const UpdateTalaGoalStatusSchema = z.object({
  status: z.enum(["active", "done"], {
    message: "Invalid status",
  }),
});

// ---- Talla Briefings ----

export const CreateTalaBriefingSchema = z.object({
  briefDate: z.string().min(1, "Brief date is required").max(100),
  summary: z.string().min(1, "Summary is required").max(5000),
  highlights: z.array(z.string().max(500)).max(20).optional().default([]),
});

// ---- Talla Wins ----

export const CreateTalaWinSchema = z.object({
  briefDate: z.string().min(1, "Brief date is required").max(100),
  text: z.string().min(1, "Text is required").max(2000),
});
