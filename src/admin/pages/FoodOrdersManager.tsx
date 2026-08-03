import { useMemo, useState } from "react";
import { Search, UtensilsCrossed, Pencil, Trash2, CheckCircle, XCircle, ChefHat } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Select, Modal } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { formatPHP, formatDate, textSearch, uid, generateReference } from "../ops/opsUtils";
import type { FoodOrder, MenuItem } from "@/types/cms";

const STATUS_OPTIONS: FoodOrder["status"][] = ["pending", "preparing", "delivered", "cancelled"];

const statusColor = (s: string) => {
  switch (s) {
    case "pending": return "#fbbf24";
    case "preparing": return "#60a5fa";
    case "delivered": return "#4ade80";
    case "cancelled": return "#f87171";
    default: return "#e8e8e8";
  }
};

export default function FoodOrdersManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FoodOrder["status"] | "all">("all");
  const [editingMenu, setEditingMenu] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const orders = data.operations.foodOrders;
  const menuItems = data.operations.menuItems;

  const filtered = useMemo(() => {
    let list = textSearch(orders, search, ["guestName", "reference", "guestPhone"]);
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const revenueToday = ordersToday.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;

  const updateStatus = (id: string, status: FoodOrder["status"]) => {
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        foodOrders: d.operations.foodOrders.map((o) => (o.id === id ? { ...o, status } : o)),
      },
    }));
    notify(`Order ${status}`);
  };

  const removeOrder = (o: FoodOrder) => {
    if (!window.confirm(`Delete order ${o.reference}?`)) return;
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        foodOrders: d.operations.foodOrders.filter((x) => x.id !== o.id),
      },
    }));
    notify("Order deleted");
  };

  const saveMenuItem = (item: MenuItem) => {
    const exists = menuItems.some((m) => m.id === item.id);
    const next = exists ? menuItems.map((m) => (m.id === item.id ? item : m)) : [...menuItems, item];
    update((d) => ({ ...d, operations: { ...d.operations, menuItems: next } }));
    notify(exists ? "Menu item updated" : "Menu item added");
    setEditingItem(null);
  };

  const toggleMenuItem = (id: string, active: boolean) => {
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        menuItems: d.operations.menuItems.map((m) => (m.id === id ? { ...m, active } : m)),
      },
    }));
  };

  const removeMenuItem = (id: string) => {
    if (!window.confirm("Delete this menu item?")) return;
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        menuItems: d.operations.menuItems.filter((m) => m.id !== id),
      },
    }));
    notify("Menu item deleted");
  };

  return (
    <div>
      <PageHeader
        title="Food Orders"
        description="Manage guest food & drink orders and menu items"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingMenu(!editingMenu)}>
              {editingMenu ? "View Orders" : "Edit Menu"}
            </Button>
            {!editingMenu && (
              <Button onClick={() => setEditingItem({ id: "", name: "", description: "", category: "food", price: 0, active: true, order: menuItems.length })}>
                Add Menu Item
              </Button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Orders Today" value={String(ordersToday.length)} />
        <KpiCard label="Revenue Today" value={formatPHP(revenueToday)} tone="positive" />
        <KpiCard label="Pending" value={String(pendingCount)} tone="warning" />
        <KpiCard label="Preparing" value={String(preparingCount)} />
      </div>

      {editingMenu ? (
        /* -------- Menu Editor -------- */
        <div className="space-y-4">
          {(["food", "drink"] as const).map((cat) => (
            <div key={cat}>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide opacity-60">{cat === "food" ? "Food" : "Drinks"}</h3>
              <div className="space-y-2">
                {menuItems.filter((m) => m.category === cat).sort((a, b) => a.order - b.order).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-white p-4">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-[#26221C]/50">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: "#C6A15B" }}>{formatPHP(item.price)}</span>
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
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* -------- Orders List -------- */
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders..."
                className="w-full rounded-lg border border-[#26221C]/10 bg-white py-2.5 pl-10 pr-4 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders from the Guest Portal will appear here." />
          ) : (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Ref</OpsTH>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Items</OpsTH>
                  <OpsTH>Total</OpsTH>
                  <OpsTH>Status</OpsTH>
                  <OpsTH>Date</OpsTH>
                  <OpsTH>Actions</OpsTH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
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
                      <StatusPill value={order.status} />
                    </OpsTD>
                    <OpsTD className="text-xs text-[#26221C]/50">{formatDate(order.createdAt)}</OpsTD>
                    <OpsTD>
                      <div className="flex items-center gap-1">
                        {order.status === "pending" && (
                          <button onClick={() => updateStatus(order.id, "preparing")} className="rounded p-1 text-blue-500 hover:bg-blue-50" title="Start preparing">
                            <ChefHat className="h-4 w-4" />
                          </button>
                        )}
                        {order.status === "preparing" && (
                          <button onClick={() => updateStatus(order.id, "delivered")} className="rounded p-1 text-green-500 hover:bg-green-50" title="Mark delivered">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {order.status !== "cancelled" && order.status !== "delivered" && (
                          <button onClick={() => updateStatus(order.id, "cancelled")} className="rounded p-1 text-red-400 hover:bg-red-50" title="Cancel">
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
          )}
        </>
      )}

      {/* Edit Menu Item Modal */}
      {editingItem && (
        <MenuItemModal item={editingItem} onSave={saveMenuItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}

function MenuItemModal({ item, onSave, onClose }: { item: MenuItem; onSave: (i: MenuItem) => void; onClose: () => void }) {
  const [form, setForm] = useState(item);
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
              onChange={(e) => setForm({ ...form, category: e.target.value as "food" | "drink" })}
              className="w-full rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
            >
              <option value="food">Food</option>
              <option value="drink">Drink</option>
            </select>
          </Field>
          <Field label="Price (PHP)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
