import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, KpiCard } from "../ops/OpsPrimitives";
import { useOperations } from "../ops/useOperations";
import {
  bulkUpsertInventory,
  deleteInventoryItem,
  upsertInventoryItem,
  INVENTORY_CATEGORIES,
  type InventoryItem,
} from "@/lib/opsRepo";
import {
  downloadTextFile,
  inventoryCsvTemplate,
  parseInventoryCsv,
  toInventoryCsv,
} from "@/lib/inventoryCsv";
import { textSearch, uid } from "../ops/opsUtils";

// ---------------------------------------------------------------------------
// Inventory — linens, towels, bathroom supplies, food, gas (gasul/LPG), fuel,
// cleaning supplies, etc. Same admin-only table pattern as bookings/staff
// (see the `inventory` migration): TALA reads this via OperationsSnapshot so
// she can answer "how much gas do we have left" or flag low stock in the
// morning brief, and the admin can add items one at a time or in bulk via a
// downloadable CSV template.
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<string, string> = {
  linens: "Linens",
  towels: "Towels",
  bathroom: "Bathroom Supplies",
  food: "Food",
  gas: "Gas (LPG / Gasul)",
  fuel: "Fuel",
  cleaning: "Cleaning Supplies",
  other: "Other",
};

const emptyItem = (): InventoryItem => ({
  id: uid("inv"),
  name: "",
  category: "other",
  unit: "pcs",
  quantity: 0,
  reorderThreshold: 0,
  unitCost: 0,
  notes: "",
  updatedAt: new Date().toISOString(),
});

export default function InventoryManager() {
  const { data: ops, refresh } = useOperations();
  const { notify } = useToast();
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items = ops.inventory;
  const lowStock = items.filter((i) => i.reorderThreshold > 0 && i.quantity <= i.reorderThreshold);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const filtered = useMemo(() => {
    const byCategory = category === "all" ? items : items.filter((i) => i.category === category);
    return textSearch(byCategory, search, ["name", "notes"]).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [items, category, search]);

  const save = async (item: InventoryItem) => {
    const exists = items.some((x) => x.id === item.id);
    const ok = await upsertInventoryItem(item);
    if (!ok) return notify("Could not save item", "info");
    await refresh();
    notify(exists ? "Item updated" : "Item added");
    setEditing(null);
  };

  const remove = async (item: InventoryItem) => {
    if (!window.confirm(`Remove ${item.name} from inventory?`)) return;
    const ok = await deleteInventoryItem(item.id);
    if (!ok) return notify("Could not remove item", "info");
    await refresh();
    notify("Item removed");
  };

  const downloadTemplate = () => downloadTextFile("inventory-template.csv", inventoryCsvTemplate());
  const downloadAll = () => downloadTextFile("inventory-export.csv", toInventoryCsv(items));

  const handleBulkUploadFile = async (file: File) => {
    const text = await file.text();
    const { rows, errors } = parseInventoryCsv(text, items);
    if (!rows.length) {
      setUploadSummary(errors.length ? errors.join(" ") : "No valid rows found in that file.");
      return;
    }
    setUploading(true);
    try {
      const ok = await bulkUpsertInventory(rows);
      if (!ok) {
        setUploadSummary("Upload failed — check Supabase is connected and try again.");
        return;
      }
      setUploadSummary(
        `Imported ${rows.length} item${rows.length === 1 ? "" : "s"}.` +
          (errors.length ? ` ${errors.length} row(s) skipped: ${errors.join(" ")}` : ""),
      );
      notify(`Imported ${rows.length} inventory item${rows.length === 1 ? "" : "s"}`);
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Linens, towels, bathroom supplies, food, gas, fuel — track stock on hand and get flagged when something's running low. TALA reads this too, so she can mention it in the morning brief."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileText className="h-4 w-4" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={downloadAll} disabled={items.length === 0}>
              <Download className="h-4 w-4" /> Download All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBulkUploadFile(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={() => setEditing(emptyItem())}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </>
        }
      />

      {uploadSummary && (
        <Card className="mb-6 border-[#C6A15B]/30 bg-[#FAF6EF] p-4 text-sm text-[#26221C]/80">
          {uploadSummary}
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Items tracked" value={String(items.length)} />
        <KpiCard
          label="Low stock"
          value={String(lowStock.length)}
          tone={lowStock.length > 0 ? "warning" : "default"}
        />
        <KpiCard label="Stock value" value={`₱${Math.round(totalValue).toLocaleString("en-PH")}`} />
      </div>

      {lowStock.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Running low — worth reordering soon
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <span
                key={i.id}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-800 shadow-sm"
              >
                {i.name}: {i.quantity} {i.unit} left
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
          <option value="all">All categories</option>
          {INVENTORY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No inventory items yet"
          description="Add your first item, or download the template and bulk-upload your stock list."
        />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <OpsTH>Item</OpsTH>
              <OpsTH>Category</OpsTH>
              <OpsTH>On hand</OpsTH>
              <OpsTH>Reorder at</OpsTH>
              <OpsTH>Unit cost</OpsTH>
              <OpsTH className="text-right">Actions</OpsTH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const low = i.reorderThreshold > 0 && i.quantity <= i.reorderThreshold;
              return (
                <tr key={i.id} className="hover:bg-[#FAF6EF]/60">
                  <OpsTD>
                    <div className="font-medium">{i.name}</div>
                    {i.notes && <div className="text-xs text-[#26221C]/45">{i.notes}</div>}
                  </OpsTD>
                  <OpsTD>{CATEGORY_LABEL[i.category] ?? i.category}</OpsTD>
                  <OpsTD>
                    <span className={low ? "font-medium text-amber-700" : ""}>
                      {i.quantity} {i.unit}
                    </span>
                  </OpsTD>
                  <OpsTD>{i.reorderThreshold > 0 ? `${i.reorderThreshold} ${i.unit}` : "—"}</OpsTD>
                  <OpsTD>{i.unitCost > 0 ? `₱${i.unitCost.toLocaleString("en-PH")}` : "—"}</OpsTD>
                  <OpsTD className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(i)}
                        className="rounded-md p-1.5 text-[#26221C]/50 hover:bg-[#26221C]/5"
                        aria-label="Edit item"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(i)}
                        className="rounded-md p-1.5 text-red-400 hover:bg-red-50"
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </OpsTD>
                </tr>
              );
            })}
          </tbody>
        </OpsTable>
      )}

      {editing && <ItemModal item={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ItemModal({
  item,
  onClose,
  onSave,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSave: (i: InventoryItem) => void;
}) {
  const [d, setD] = useState<InventoryItem>(item);
  const patch = (p: Partial<InventoryItem>) => setD((x) => ({ ...x, ...p }));

  return (
    <Modal open onClose={onClose} title={item.name ? "Edit Item" : "Add Item"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item name">
            <Input
              value={d.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Bath towels"
            />
          </Field>
          <Field label="Category">
            <Select value={d.category} onChange={(e) => patch({ category: e.target.value as any })}>
              {INVENTORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unit" hint="pcs, kg, liters, tanks, rolls…">
            <Input value={d.unit} onChange={(e) => patch({ unit: e.target.value })} />
          </Field>
          <Field label="Quantity on hand">
            <Input
              type="number"
              value={d.quantity}
              onChange={(e) => patch({ quantity: parseFloat(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Reorder threshold" hint="alert when stock drops to this or below">
            <Input
              type="number"
              value={d.reorderThreshold}
              onChange={(e) => patch({ reorderThreshold: parseFloat(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Unit cost (PHP)">
            <Input
              type="number"
              value={d.unitCost}
              onChange={(e) => patch({ unitCost: parseFloat(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            rows={2}
            value={d.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Supplier, where to reorder, brand, etc."
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onSave(d)} disabled={!d.name.trim()}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
