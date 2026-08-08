// React Query hooks for Cloudflare Worker API.
// Provides useQuery/useMutation hooks for all Phase 4 operational domains.
// Drop-in replacement for direct Supabase calls in React components.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./workerApi";
import type {
  PropertySetting,
  HousekeepingTask,
  MaintenanceRequest,
  MenuItem,
  FoodOrder,
  InventoryItem,
  TalaTask,
  TalaLead,
  TalaGoal,
  TalaBriefing,
  TalaWin,
  GuestRequest,
} from "./workerApi";

// ============================================================
// PROPERTY SETTINGS
// ============================================================

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.list().then((r) => r.settings),
  });
}

export function useSettingsByCategory(category: string) {
  return useQuery({
    queryKey: ["settings", category],
    queryFn: () => api.settings.listByCategory(category).then((r) => r.settings),
    enabled: !!category,
  });
}

export function useUpsertSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category: string; key: string; value: string }) =>
      api.settings.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDeleteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.settings.delete(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ============================================================
// GUEST REQUESTS
// ============================================================

export function useGuestRequests(filters?: { type?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: ["requests", filters],
    queryFn: () => api.requests.list(filters).then((r) => r.requests),
  });
}

export function useGuestRequest(id: string) {
  return useQuery({
    queryKey: ["requests", id],
    queryFn: () => api.requests.get(id).then((r) => r.request),
    enabled: !!id,
  });
}

export function useCreateGuestRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.requests.create>[0]) =>
      api.requests.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useUpdateGuestRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.requests.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

// ============================================================
// HOUSEKEEPING
// ============================================================

export function useHousekeepingTasks(filters?: { status?: string; room?: string; limit?: number }) {
  return useQuery({
    queryKey: ["housekeeping", filters],
    queryFn: () => api.housekeeping.list(filters).then((r) => r.tasks),
  });
}

export function useHousekeepingTask(id: string) {
  return useQuery({
    queryKey: ["housekeeping", id],
    queryFn: () => api.housekeeping.get(id).then((r) => r.task),
    enabled: !!id,
  });
}

export function useCreateHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.housekeeping.create>[0]) =>
      api.housekeeping.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping"] }),
  });
}

export function useUpdateHousekeepingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.housekeeping.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping"] }),
  });
}

export function useDeleteHousekeepingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.housekeeping.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["housekeeping"] }),
  });
}

// ============================================================
// MAINTENANCE
// ============================================================

export function useMaintenanceRequests(filters?: { status?: string; priority?: string; limit?: number }) {
  return useQuery({
    queryKey: ["maintenance", filters],
    queryFn: () => api.maintenance.list(filters).then((r) => r.requests),
  });
}

export function useMaintenanceRequest(id: string) {
  return useQuery({
    queryKey: ["maintenance", id],
    queryFn: () => api.maintenance.get(id).then((r) => r.request),
    enabled: !!id,
  });
}

export function useCreateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.maintenance.create>[0]) =>
      api.maintenance.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.maintenance.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

export function useDeleteMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.maintenance.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

// ============================================================
// MENU ITEMS
// ============================================================

export function useMenuItems(options?: { activeOnly?: boolean; category?: string }) {
  return useQuery({
    queryKey: ["menu", options],
    queryFn: () => api.menu.list(options).then((r) => r.items),
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: ["menu", id],
    queryFn: () => api.menu.get(id).then((r) => r.item),
    enabled: !!id,
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.menu.create>[0]) =>
      api.menu.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.menu.update>[1] }) =>
      api.menu.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.menu.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });
}

// ============================================================
// FOOD ORDERS
// ============================================================

export function useFoodOrders(filters?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: () => api.orders.list(filters).then((r) => r.orders),
  });
}

export function useFoodOrder(id: string) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.orders.get(id).then((r) => r.order),
    enabled: !!id,
  });
}

export function useCreateFoodOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.orders.create>[0]) =>
      api.orders.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.orders.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// ============================================================
// INVENTORY
// ============================================================

export function useInventory(options?: { category?: string; lowStock?: boolean }) {
  return useQuery({
    queryKey: ["inventory", options],
    queryFn: () => api.inventory.list(options).then((r) => r.items),
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: ["inventory", id],
    queryFn: () => api.inventory.get(id).then((r) => r.item),
    enabled: !!id,
  });
}

export function useUpsertInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.inventory.upsert>[0]) =>
      api.inventory.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useBulkUpsertInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Parameters<typeof api.inventory.bulkUpsert>[0]) =>
      api.inventory.bulkUpsert(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useAdjustInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adjustment }: { id: string; adjustment: number }) =>
      api.inventory.adjust(id, adjustment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.inventory.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

// ============================================================
// TALLA TASKS
// ============================================================

export function useTallaTasks(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ["talla-tasks", filters],
    queryFn: () => api.tallaTasks.list(filters).then((r) => r.tasks),
  });
}

export function useCreateTallaTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.tallaTasks.create>[0]) =>
      api.tallaTasks.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-tasks"] }),
  });
}

export function useUpdateTallaTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.tallaTasks.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-tasks"] }),
  });
}

// ============================================================
// TALLA LEADS
// ============================================================

export function useTallaLeads(filters?: { source?: string; limit?: number }) {
  return useQuery({
    queryKey: ["talla-leads", filters],
    queryFn: () => api.tallaLeads.list(filters).then((r) => r.leads),
  });
}

export function useCreateTallaLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.tallaLeads.create>[0]) =>
      api.tallaLeads.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-leads"] }),
  });
}

// ============================================================
// TALLA GOALS
// ============================================================

export function useTallaGoals(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["talla-goals", filters],
    queryFn: () => api.tallaGoals.list(filters).then((r) => r.goals),
  });
}

export function useCreateTallaGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.tallaGoals.create>[0]) =>
      api.tallaGoals.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-goals"] }),
  });
}

export function useUpdateTallaGoalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.tallaGoals.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-goals"] }),
  });
}

// ============================================================
// TALLA BRIEFINGS
// ============================================================

export function useTallaBriefings(filters?: { limit?: number }) {
  return useQuery({
    queryKey: ["talla-briefings", filters],
    queryFn: () => api.tallaBriefings.list(filters).then((r) => r.briefings),
  });
}

export function useCreateTallaBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.tallaBriefings.create>[0]) =>
      api.tallaBriefings.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-briefings"] }),
  });
}

export function useMarkBriefingWhatsappSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tallaBriefings.markWhatsappSent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-briefings"] }),
  });
}

// ============================================================
// TALLA WINS
// ============================================================

export function useTallaWins(filters?: { limit?: number }) {
  return useQuery({
    queryKey: ["talla-wins", filters],
    queryFn: () => api.tallaWins.list(filters).then((r) => r.wins),
  });
}

export function useCreateTallaWin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.tallaWins.create>[0]) =>
      api.tallaWins.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["talla-wins"] }),
  });
}
