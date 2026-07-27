import { useMemo, useState } from "react";
import { Plus, Trash2, Search, ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Field, Input, Textarea, Select, Modal } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, KpiCard } from "../ops/OpsPrimitives";
import { useOperations } from "../ops/useOperations";
import { upsertPayment, deletePayment } from "@/lib/opsRepo";
import { formatPHP, formatDate, todayISO, generateReference, textSearch, uid } from "../ops/opsUtils";
import type { Payment, PaymentMethod } from "@/types/cms";

const emptyPayment = (): Payment => ({
  id: uid("pay"), reference: generateReference("PAY"),
  date: todayISO(), category: "other", direction: "in",
  amount: 0, method: "cash", relatedId: "", description: "", notes: "",
});

export default function PaymentsManager() {
  const { data: ops, refresh } = useOperations();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "in" | "out">("all");
  const [range, setRange] = useState<7 | 30 | 90 | 365>(30);

  const payments = ops.payments;

  const filtered = useMemo(() => {
    let list = textSearch(payments, search, ["description", "reference", "notes"]);
    if (dirFilter !== "all") list = list.filter((p) => p.direction === dirFilter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, search, dirFilter]);

  const rangeMs = range * 86400000;
  const inRange = payments.filter((p) => new Date(p.date).getTime() > Date.now() - rangeMs);
  const revenue = inRange.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
  const expenses = inRange.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);
  const net = revenue - expenses;

  const save = async (p: Payment) => {
    const exists = payments.some((x) => x.id === p.id);
    const ok = await upsertPayment(p);
    if (!ok) return notify("Could not save payment", "info");
    await refresh();
    notify(exists ? "Payment updated" : "Payment recorded");
    setEditing(null);
  };

  const remove = async (p: Payment) => {
    if (!window.confirm(`Delete payment ${p.reference}?`)) return;
    const ok = await deletePayment(p.id);
    if (!ok) return notify("Could not delete payment", "info");
    await refresh();
    notify("Payment deleted");
  };

  const exportCSV = () => {
    const header = "Reference,Date,Direction,Category,Amount,Method,Description\n";
    const rows = filtered.map((p) =>
      [p.reference, p.date, p.direction, p.category, p.amount, p.method, `"${p.description.replace(/"/g, '""')}"`].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `marina-payments-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
    notify("CSV exported");
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Full financial ledger: bookings, tours, rentals, salaries and expenses in one place."
        actions={
          <>
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Button>
            <Button onClick={() => setEditing(emptyPayment())}><Plus className="h-4 w-4" /> Record Payment</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#26221C]/45">Period:</span>
        {[7, 30, 90, 365].map((n) => (
          <button
            key={n}
            onClick={() => setRange(n as any)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-all duration-150 active:scale-[0.97] ${
              range === n
                ? "bg-[#26221C] text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                : "border border-[#26221C]/10 bg-white text-[#26221C]/60 hover:border-[#26221C]/20 hover:text-[#26221C]"
            }`}
          >
            {n === 365 ? "1 year" : `${n} days`}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Revenue" value={formatPHP(revenue)} tone="positive" />
        <KpiCard label="Expenses" value={formatPHP(expenses)} tone="warning" />
        <KpiCard label="Net Profit" value={formatPHP(net)} tone={net >= 0 ? "positive" : "warning"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={dirFilter} onChange={(e) => setDirFilter(e.target.value as any)} className="max-w-[180px]">
          <option value="all">All transactions</option>
          <option value="in">Revenue only</option>
          <option value="out">Expenses only</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No payments recorded" description='Click "Record Payment" to add your first transaction.' />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <OpsTH>Reference</OpsTH>
              <OpsTH>Date</OpsTH>
              <OpsTH>Description</OpsTH>
              <OpsTH>Category</OpsTH>
              <OpsTH>Method</OpsTH>
              <OpsTH className="text-right">Amount</OpsTH>
              <OpsTH className="text-right">&nbsp;</OpsTH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-[#FAF6EF]/60">
                <OpsTD><span className="font-mono text-xs text-[#26221C]/60">{p.reference}</span></OpsTD>
                <OpsTD className="text-xs">{formatDate(p.date)}</OpsTD>
                <OpsTD>
                  <div className="max-w-[300px] truncate">{p.description || "—"}</div>
                  {p.notes && <div className="max-w-[300px] truncate text-xs text-[#26221C]/45">{p.notes}</div>}
                </OpsTD>
                <OpsTD className="text-xs capitalize text-[#26221C]/60">{p.category}</OpsTD>
                <OpsTD className="text-xs uppercase text-[#26221C]/60">{p.method.replace("_", " ")}</OpsTD>
                <OpsTD className="text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${p.direction === "in" ? "text-green-700" : "text-red-600"}`}>
                    {p.direction === "in" ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    {formatPHP(p.amount)}
                  </span>
                </OpsTD>
                <OpsTD className="text-right">
                  <button onClick={() => remove(p)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </OpsTD>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}

      {editing && <PaymentModal payment={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function PaymentModal({ payment, onClose, onSave }: { payment: Payment; onClose: () => void; onSave: (p: Payment) => void }) {
  const [d, setD] = useState<Payment>(payment);
  const patch = (p: Partial<Payment>) => setD((x) => ({ ...x, ...p }));
  return (
    <Modal open onClose={onClose} title={payment.description ? "Edit Payment" : "Record Payment"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reference"><Input value={d.reference} onChange={(e) => patch({ reference: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={d.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
          <Field label="Direction">
            <Select value={d.direction} onChange={(e) => patch({ direction: e.target.value as any })}>
              <option value="in">Revenue (money in)</option>
              <option value="out">Expense (money out)</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={d.category} onChange={(e) => patch({ category: e.target.value as any })}>
              <option value="booking">Booking</option>
              <option value="tour">Tour</option>
              <option value="rental">Motorbike Rental</option>
              <option value="expense">Expense / Salary</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Amount (PHP)">
            <Input type="number" value={d.amount} onChange={(e) => patch({ amount: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Payment Method">
            <Select value={d.method} onChange={(e) => patch({ method: e.target.value as PaymentMethod })}>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Input value={d.description} onChange={(e) => patch({ description: e.target.value })} placeholder="e.g. Booking MT-2026-045 — Aria Voss" />
        </Field>
        <Field label="Notes"><Textarea rows={2} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(d)} disabled={d.amount <= 0 || !d.description.trim()}>Save Payment</Button>
      </div>
    </Modal>
  );
}
