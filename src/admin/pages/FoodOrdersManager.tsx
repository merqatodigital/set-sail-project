import { useMemo, useState } from "react";
import { Search, Pencil, Trash2, CheckCircle, XCircle, ChefHat, Plus, Package, AlertTriangle } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Modal } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { formatPHP, formatDate, textSearch, uid, generateReference } from "../ops/opsUtils";
import type { FoodOrder, MenuItem, FoodOrderStatus, MenuCategory } from "@/types/cms";

const ORDER_STATUSES: FoodOrderStatus[] = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];
const MENU_CATEGORIES: MenuCategory[] = ["breakfast", "lunch", "dinner", "drinks"];

const statusColor = (s: FoodOrderStatus) => {
  switch (s) {
    case "pending": return "#fbbf24";
    case "confirmed": return "#60a5fa";
    case "preparing": return "#a78bfa";
    case "ready": return "#34d399";
    case "delivered": return "#4ade80";
    case "cancelled": return "#f87171";
    default: return "#e8e8e8";
  }
};

const statusLabel = (s: FoodOrderStatus) => s.charAt(0).toUpperCase() + s.slice(1);

export default function FoodOrdersManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FoodOrderStatus | "all">("all");
  const [catFilter, setCatFilter] = useState<MenuCategory | "all">("all");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);

  const orders = data.operations.foodOrders;
  const menuItems = data.operations.menuItems;

  const filteredOrders = useMemo(() => {
    let list = textSearch(orders, search, ["guestName", "reference", "guestPhone"]);
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const filteredMenu = useMemo(() => {
    let list = textSearch(menuItems, search, ["name", "description"]);
    if (catFilter !== "all") list = list.filter((m) => m.category === catFilter);
    return [...list].sort((a, b) => a.order - b.order);
  }, [menuItems, search, catFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const revenueToday = ordersToday.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const costToday = ordersToday.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.totalCost, 0);
  const profitToday = revenueToday - costToday;
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const lowStockItems = menuItems.filter((m) => m.active && m.inventoryCount > 0 && m.inventoryCount < 5);
  const soldOutItems = menuItems.filter((m) => m.active && m.inventoryCount === 0);

  const updateOrderStatus = (id: string, status: FoodOrderStatus) => {
    const now = new Date().toISOString();
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        foodOrders: d.operations.foodOrders.map((o) => {
          if (o.id !== id) return o;
          const patch: Partial<FoodOrder> = { status };
          if (status === "confirmed") patch.confirmedAt = now;
          if (status === "preparing") patch.preparingAt = now;
          if (status === "ready") patch.readyAt = now;
          if (status === "delivered") patch.deliveredAt = now;
          if (status === "cancelled") patch.cancelledAt = now;
          return { ...o, ...patch };
        }),
      },
    }));
    notify(`Order ${statusLabel(status)}`);
  };

  const removeOrder = (o: FoodOrder) => {
    if (!window.confirm(`Delete order ${o.reference}?`)) return;
    update((d) => ({
      ...d,
      operations: { ...d.operations, foodOrders: d.operations.foodOrders.filter((x) => x.id !== o.id) },
    }));
    notify("Order deleted");
  };

  const saveMenuItem = (item: MenuItem) => {
    const exists = menuItems.some((m) => m.id === item.id);
    const next = exists ? menuItems.map((m) => (m.id === item.id ? item : m)) : [...menuItems, item];
    update((d) => ({ ...d, operations: { ...d.operations, menuItems: next } }));
    notify(exists ? "Menu item updated" : "Menu item added");
    setEditingItem(null);
    setShowNewItem(false);
  };

  const toggleMenuItem = (id: string, active: boolean) => {
    update((d) => ({
      ...d,
      operations: { ...d.operations, menuItems: d.operations.menuItems.map((m) => (m.id === id ? { ...m, active } : m)) },
    }));
  };

  const restockItem = (id: string, qty: number) => {
    update((d) => ({
      ...d,
      operations: { ...d.operations, menuItems: d.operations.menuItems.map((m) => (m.id === id ? { ...m, inventoryCount: m.inventoryCount + qty } : m)) },
    }));
    notify("Inventory restocked");
  };

  const removeMenuItem = (id: string) => {
    if (!window.confirm("Delete this menu item?")) return;
    update((d) => ({
      ...d,
      operations: { ...d.operations, menuItems: d.operations.menuItems.filter((m) => m.id !== id) },
    }));
    notify("Menu item deleted");
  };

  return (
    <div>
      <PageHeader
        title="Kitchen & Food Orders"
        description="Manage menu, inventory, and guest orders"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTab(tab === "orders" ? "menu" : "orders")}>
              {tab === "orders" ? "Edit Menu" : "View Orders"}
            </Button>
            {tab === "menu" && (
              <Button onClick={() => setShowNewItem(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add Item
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Orders Today" value={String(ordersToday.length)} />
        <KpiCard label="Revenue Today" value={formatPHP(revenueToday)} tone="positive" />
        <KpiCard label="Profit Today" value={formatPHP(profitToday)} />
        <KpiCard label="Pending Orders" value={String(pendingCount)} tone={pendingCount > 0 ? "warning" : undefined} />
      </div>

      {/* Alerts */}
      {(lowStockItems.length > 0 || soldOutItems.length > 0) && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Inventory Alerts</span>
          </div>
          <div className="mt-2 space-y-1">
            {soldOutItems.map((item) => (
              <p key={item.id} className="text-xs text-red-600">
                <strong>{item.name}</strong> — SOLD OUT (0 portions)
              </p>
            ))}
            {lowStockItems.map((item) => (
              <p key={item.id} className="text-xs text-amber-600">
                <strong>{item.name}</strong> — Low stock ({item.inventoryCount} portions left)
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "orders" ? "Search orders..." : "Search menu..."}
            className="w-full rounded-lg border border-[#26221C]/10 bg-white py-2.5 pl-10 pr-4 text-sm"
          />
        </div>
        {tab === "orders" ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">All Status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        ) : (
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as any)}
            className="rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">All Categories</option>
            {MENU_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        )}
      </div>

      {tab === "orders" ? (
        filteredOrders.length === 0 ? (
          <EmptyState title="No orders yet" description="Orders from the Guest Portal and TALA will appear here." />
        ) : (
          <OpsTable>
            <thead>
              <tr>
                <OpsTH>Ref</OpsTH>
                <OpsTH>Guest</OpsTH>
                <OpsTH>Items</OpsTH>
                <OpsTH>Total</OpsTH>
                <OpsTH>Cost</OpsTH>
                <OpsTH>Status</OpsTH>
                <OpsTH>Date</OpsTH>
                <OpsTH>Actions</OpsTH>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-t border-[#26221C]/5">
                  <OpsTD className="font-mono text-xs">{order.reference}</OpsTD>
                  <OpsTD>
                    <p className="font-medium">{order.guestName}</p>
                    <p className="text-xs text-[#26221C]/40">{order.guestPhone}</p>
                  </OpsTD>
                  <OpsTD>
                    <p className="text-xs">{order.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}</p>
                  </OpsTD>
                  <OpsTD>
                    <span className="font-semibold" style={{ color: "#C6A15B" }}>{formatPHP(order.total)}</span>
                  </OpsTD>
                  <OpsTD>
                    <span className="text-xs text-[#26221C]/50">{formatPHP(order.totalCost)}</span>
                  </OpsTD>
                  <OpsTD>
                    <StatusPill value={order.status} />
                  </OpsTD>
                  <OpsTD className="text-xs text-[#26221C]/50">{formatDate(order.createdAt)}</OpsTD>
                  <OpsTD>
                    <div className="flex items-center gap-1">
                      {order.status === "pending" && (
                        <button onClick={() => updateOrderStatus(order.id, "confirmed")} className="rounded p-1 text-blue-500 hover:bg-blue-50" title="Confirm">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {order.status === "confirmed" && (
                        <button onClick={() => updateOrderStatus(order.id, "preparing")} className="rounded p-1 text-purple-500 hover:bg-purple-50" title="Start preparing">
                          <ChefHat className="h-4 w-4" />
                        </button>
                      )}
                      {order.status === "preparing" && (
                        <button onClick={() => updateOrderStatus(order.id, "ready")} className="rounded p-1 text-green-500 hover:bg-green-50" title="Mark ready">
                          <Package className="h-4 w-4" />
                        </button>
                      )}
                      {order.status === "ready" && (
                        <button onClick={() => updateOrderStatus(order.id, "delivered")} className="rounded p-1 text-green-600 hover:bg-green-50" title="Mark delivered">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {!["delivered", "cancelled"].includes(order.status) && (
                        <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="rounded p-1 text-red-400 hover:bg-red-50" title="Cancel">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => removeOrder(order)} className="rounded p-1 text-[#26221C]/30 hover:text-red-500" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </OpsTD>
                </tr>
              ))}
            </tbody>
          </OpsTable>
        )
      ) : (
        /* -------- Menu Editor -------- */
        <div className="space-y-6">
          {MENU_CATEGORIES.map((cat) => {
            const items = filteredMenu.filter((m) => m.category === cat);
            if (catFilter !== "all" && catFilter !== cat) return null;
            const catRevenue = items.reduce((s, m) => {
              const sold = orders.filter((o) => o.status !== "cancelled" && o.items.some((i) => i.menuItemId === m.id)).reduce((ss, o) => ss + o.items.filter((i) => i.menuItemId === m.id).reduce((sss, i) => sss + i.quantity, 0), 0);
              return s + sold * m.price;
            }, 0);
            const catCost = items.reduce((s, m) => {
              const sold = orders.filter((o) => o.status !== "cancelled" && o.items.some((i) => i.menuItemId === m.id)).reduce((ss, o) => ss + o.items.filter((i) => i.menuItemId === m.id).reduce((sss, i) => sss + i.quantity, 0), 0);
              return s + sold * m.foodCost;
            }, 0);
            return (
              <div key={cat}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide">{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
                  <div className="flex items-center gap-4 text-xs text-[#26221C]/50">
                    <span>{items.length} items</span>
                    <span>Revenue: <strong style={{ color: "#C6A15B" }}>{formatPHP(catRevenue)}</strong></span>
                    <span>Cost: <strong>{formatPHP(catCost)}</strong></span>
                    <span>Profit: <strong style={{ color: catRevenue - catCost > 0 ? "#16a34a" : "#dc2626" }}>{formatPHP(catRevenue - catCost)}</strong></span>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-white p-4">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-[#26221C]/50">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: "#C6A15B" }}>{formatPHP(item.price)}</p>
                          <p className="text-xs text-[#26221C]/40">Cost: {formatPHP(item.foodCost)} · Margin: {formatPHP(item.price - item.foodCost)}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${item.inventoryCount === 0 ? "text-red-500" : item.inventoryCount < 5 ? "text-amber-500" : "text-green-600"}`}>
                            {item.inventoryCount} left
                          </p>
                          <button onClick={() => restockItem(item.id, 10)} className="text-xs text-[#26221C]/40 hover:text-[#C6A15B]">+10</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingItem(item)} className="text-[#26221C]/40 hover:text-[#C6A15B]">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => toggleMenuItem(item.id, !item.active)} className={`text-xs ${item.active ? "text-green-600" : "text-[#26221C]/30"}`}>
                            {item.active ? "Active" : "Hidden"}
                          </button>
                          <button onClick={() => removeMenuItem(item.id)} className="text-[#26221C]/30 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Menu Item Modal */}
      {(editingItem || showNewItem) && (
        <MenuItemModal
          item={editingItem || { id: "", name: "", description: "", category: "breakfast", price: 0, foodCost: 0, inventoryCount: 20, active: true, order: menuItems.length }}
          onSave={saveMenuItem}
          onClose={() => { setEditingItem(null); setShowNewItem(false); }}
        />
      )}
    </div>
  );
}

function MenuItemModal({ item, onSave, onClose }: { item: MenuItem; onSave: (i: MenuItem) => void; onClose: () => void }) {
  const [form, setForm] = useState(item);
  const margin = form.price - form.foodCost;
  const marginPct = form.price > 0 ? Math.round((margin / form.price) * 100) : 0;

  return (
    <Modal open onClose={onClose} title={item.id ? "Edit Menu Item" : "Add Menu Item"}>
      <div className="space-y-4">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as MenuCategory })}
              className="w-full rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
            >
              {MENU_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Price (PHP)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Food Cost (PHP)">
            <Input type="number" value={form.foodCost} onChange={(e) => setForm({ ...form, foodCost: Number(e.target.value) })} />
          </Field>
          <Field label="Inventory (portions)">
            <Input type="number" value={form.inventoryCount} onChange={(e) => setForm({ ...form, inventoryCount: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <p>Margin: <strong style={{ color: margin > 0 ? "#16a34a" : "#dc2626" }}>{formatPHP(margin)}</strong> ({marginPct}%)</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
