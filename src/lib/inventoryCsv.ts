import { INVENTORY_CATEGORIES, type InventoryCategory, type InventoryItem } from "./opsRepo";

// ---------------------------------------------------------------------------
// Inventory CSV import/export — same minimal RFC4180-ish parser used for
// TALA's knowledge base (src/components/tala/talaKnowledge.ts), tailored to
// the inventory columns. Kept as its own small copy rather than a shared
// generic parser so a change to one CSV format can't silently affect the
// other.
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  "name",
  "category",
  "unit",
  "quantity",
  "reorder_threshold",
  "unit_cost",
  "notes",
] as const;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.trim().length) rows.push(cur);
      cur = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length) rows.push(cur);
  return rows;
}

const BOM = String.fromCharCode(0xfeff);

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategory(raw: string): InventoryCategory {
  const v = raw.trim().toLowerCase();
  return (INVENTORY_CATEGORIES as string[]).includes(v) ? (v as InventoryCategory) : "other";
}

/**
 * Parses a bulk-upload CSV into ready-to-insert InventoryItem rows.
 * Existing items keep their id when a row's `name` matches one case-
 * insensitively (so re-uploading an edited export updates in place instead
 * of duplicating); new names get a fresh id.
 */
export function parseInventoryCsv(
  text: string,
  existing: InventoryItem[] = [],
): { rows: InventoryItem[]; errors: string[] } {
  const withoutBom = text.startsWith(BOM) ? text.slice(1) : text;
  const lines = splitCsvRows(withoutBom);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["Empty file."] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], errors: [`Missing column(s): ${missing.join(", ")}`] };
  }

  const byName = new Map(existing.map((i) => [i.name.trim().toLowerCase(), i]));
  const rows: InventoryItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.every((f) => !f.trim())) continue;
    const get = (col: (typeof CSV_COLUMNS)[number]) => fields[header.indexOf(col)] ?? "";
    const name = get("name").trim();
    if (!name) {
      errors.push(`Row ${i + 1}: name is required — skipped.`);
      continue;
    }
    const match = byName.get(name.toLowerCase());
    rows.push({
      id: match?.id ?? uid("inv"),
      name,
      category: normalizeCategory(get("category")),
      unit: get("unit").trim() || "pcs",
      quantity: Number(get("quantity")) || 0,
      reorderThreshold: Number(get("reorder_threshold")) || 0,
      unitCost: Number(get("unit_cost")) || 0,
      notes: get("notes").trim(),
      updatedAt: new Date().toISOString(),
    });
  }
  return { rows, errors };
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toInventoryCsv(items: InventoryItem[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = items.map((i) =>
    [
      csvEscape(i.name),
      csvEscape(i.category),
      csvEscape(i.unit),
      csvEscape(i.quantity),
      csvEscape(i.reorderThreshold),
      csvEscape(i.unitCost),
      csvEscape(i.notes),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

/** A filled-in example row per common category, so admins see the right shape. */
export function inventoryCsvTemplate(): string {
  return [
    CSV_COLUMNS.join(","),
    "Bath towels,towels,pcs,40,10,180,Standard white bath towels",
    "Bedsheets (queen),linens,pcs,24,6,450,",
    "Toilet paper,bathroom,rolls,60,20,15,",
    "Rice,food,kg,50,15,55,",
    "Gasul (11kg LPG tank),gas,tanks,4,1,950,Refill at San Vicente Poblacion",
    "Gasoline (motorbikes),fuel,liters,20,5,65,For rental bikes",
  ].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
