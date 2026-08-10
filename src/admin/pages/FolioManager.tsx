import { useMemo, useState } from "react";
import { Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Field, Input, Textarea, Select, Modal } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, KpiCard } from "../ops/OpsPrimitives";
import { usePortalOps } from "../ops/usePortalOps";
import { addPortalFolioLine } from "@/lib/portalAdminRepo";
import { formatPHP, formatDate, generateReference } from "../ops/opsUtils";
import type { PortalFolioLineRow } from "@/lib/portalRepo";

const CATEGORIES = ["room", "tour", "rental", "food", "service", "other"];
const METHODS = ["cash", "gcash", "bank_transfer", "card", "other"];
const RELATED_TYPES = ["booking", "tour", "rental", "food", "other"];

// normalizePhone lives in lib/portalRepo, not opsUtils. Re-export small local
// normalizer so folio grouping matches how guests' phones are stored.
function normPhone(p: string): string {
  return (p || "").replace(/[\s\-+()]/g, "").replace(/^0/, "63");
}

interface FolioForm {
  guest_name: string;
  guest_phone: string;
  kind: "charge" | "payment";
  category: string;
  description: string;
  amount: number;
  method: string;
  related_type: string;
  related_id: string;
}

const emptyForm = (kind: "charge" | "payment"): FolioForm => ({
  guest_name: "",
  guest_phone: "",
  kind,
  category: "other",
  description: "",
  amount: 0,
  method: "cash",
  related_type: "other",
  related_id: "",
});

export default function FolioManager() {
  const { folio, refresh } = usePortalOps();
  const { notify } = useToast();
  const [showForm, setShowForm] = useState<"charge" | "payment" | null>(null);
  const [form, setForm] = useState<FolioForm>(emptyForm("charge"));

  const byGuest = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; lines: PortalFolioLineRow[] }>();
    for (const line of folio) {
      const key = normPhone(line.guest_phone);
      const existing = map.get(key);
      if (existing) existing.lines.push(line);
      else map.set(key, { name: line.guest_name, phone: key, lines: [line] });
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        charges: g.lines.filter((l) => l.kind === "charge").reduce((s, l) => s + l.amount, 0),
        payments: g.lines.filter((l) => l.kind === "payment").reduce((s, l) => s + l.amount, 0),
      }))
      .sort((a, b) => b.charges - a.charges);
  }, [folio]);

  const guestsWithBalance = byGuest.filter((g) => g.charges - g.payments > 0).length;

  const openForm = (kind: "charge" | "payment") => {
    setForm(emptyForm(kind));
    setShowForm(kind);
  };

  const submit = async () => {
    if (!form.guest_name.trim() || !normPhone(form.guest_phone) || form.amount <= 0) {
      notify("Guest name, phone and a positive amount are required", "info");
      return;
    }
    const ok = await addPortalFolioLine({
      guest_name: form.guest_name.trim(),
      guest_phone: normPhone(form.guest_phone),
      kind: form.kind,
      category: form.category,
      description: form.description.trim(),
      amount: form.amount,
      method: form.method,
      reference: generateReference(form.kind === "charge" ? "FO" : "PY"),
      related_type: form.related_type,
      related_id: form.related_id.trim(),
    });
    if (!ok) return notify("Could not add folio line", "info");
    await refresh();
    notify(form.kind === "charge" ? "Charge added" : "Payment recorded");
    setShowForm(null);
  };

  return (
    <div>
      <PageHeader
        title="Guest Folio"
        description="Explicit charges and payments per guest. Each line is a real, dated record (tala_folio_lines) tied by reference / related id — no free-text payment inference."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openForm("payment")}>
              <ArrowDownLeft className="mr-1 h-4 w-4" /> Record Payment
            </Button>
            <Button onClick={() => openForm("charge")}>
              <Plus className="mr-1 h-4 w-4" /> Add Charge
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Folio lines" value={String(folio.length)} />
        <KpiCard label="Guests on folio" value={String(byGuest.length)} />
        <KpiCard label="With balance" value={String(guestsWithBalance)} tone={guestsWithBalance > 0 ? "warning" : "default"} />
        <KpiCard label="Charges" value={formatPHP(byGuest.reduce((s, g) => s + g.charges, 0))} tone="positive" />
      </div>

      {byGuest.length === 0 ? (
        <EmptyState title="No folio lines yet" description="Add explicit charges (late checkout, laundry, transfers, misc) and payments here. They appear on the guest's View Bill." />
      ) : (
        <div className="space-y-6">
          {byGuest.map((g) => {
            const balance = g.charges - g.payments;
            return (
              <div key={g.phone} className="overflow-hidden rounded-2xl border border-[#26221C]/8 bg-white shadow-sm">
                <div className="flex items-center justify-between bg-[#FAF6EF] px-5 py-3">
                  <div>
                    <p className="font-serif text-base text-[#26221C]">{g.name}</p>
                    <p className="font-mono text-xs text-[#26221C]/45">{g.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-[#26221C]/40">Balance</p>
                    <p className={`font-serif text-lg ${balance > 0 ? "text-red-600" : balance < 0 ? "text-green-700" : "text-[#26221C]"}`}>
                      {formatPHP(balance)}
                    </p>
                  </div>
                </div>
                <OpsTable>
                  <thead>
                    <tr>
                      <OpsTH>Date</OpsTH>
                      <OpsTH>Kind</OpsTH>
                      <OpsTH>Category</OpsTH>
                      <OpsTH>Description</OpsTH>
                      <OpsTH>Method</OpsTH>
                      <OpsTH>Ref / Related</OpsTH>
                      <OpsTH className="text-right">Amount</OpsTH>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.id} className="border-t border-[#26221C]/5">
                        <OpsTD className="text-xs text-[#26221C]/50">{formatDate(l.created_at)}</OpsTD>
                        <OpsTD>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${l.kind === "payment" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {l.kind === "payment" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {l.kind}
                          </span>
                        </OpsTD>
                        <OpsTD className="text-xs capitalize">{l.category}</OpsTD>
                        <OpsTD className="max-w-[320px]">{l.description || "—"}</OpsTD>
                        <OpsTD className="text-xs capitalize">{l.method}</OpsTD>
                        <OpsTD>
                          <div className="font-mono text-xs text-[#26221C]/50">{l.reference || "—"}</div>
                          {l.related_type && (
                            <div className="text-[10px] text-[#26221C]/40">{l.related_type}{l.related_id ? ` · ${l.related_id}` : ""}</div>
                          )}
                        </OpsTD>
                        <OpsTD className="text-right">
                          <span className={`font-medium ${l.kind === "payment" ? "text-green-700" : ""}`}>
                            {l.kind === "payment" ? "-" : "+"}{formatPHP(l.amount)}
                          </span>
                        </OpsTD>
                      </tr>
                    ))}
                  </tbody>
                </OpsTable>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal open onClose={() => setShowForm(null)} title={showForm === "charge" ? "Add Charge" : "Record Payment"}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Guest Name">
                <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder="e.g. Juan Dela Cruz" />
              </Field>
              <Field label="Phone">
                <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="+63 …" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </Select>
              </Field>
              <Field label={`Amount (PHP)`}>
                <Input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Method">
                <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                </Select>
              </Field>
              <Field label="Related type">
                <Select value={form.related_type} onChange={(e) => setForm({ ...form, related_type: e.target.value })}>
                  {RELATED_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Related ID (optional)">
              <Input value={form.related_id} onChange={(e) => setForm({ ...form, related_id: e.target.value })} placeholder="booking / request / order id" />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explicit reason for this line (e.g. late checkout charge, cash received for tour)" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(null)}>Cancel</Button>
              <Button onClick={submit} disabled={!form.guest_name.trim() || form.amount <= 0}>
                {showForm === "charge" ? "Add Charge" : "Record Payment"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
