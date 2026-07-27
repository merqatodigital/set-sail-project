import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Calendar as CalIcon, DollarSign, Check, X } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Select, Modal, Switch } from "@/components/ui";
import { PageHeader, EmptyState, TabBar } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, KpiCard, StatusPill } from "../ops/OpsPrimitives";
import { useOperations } from "../ops/useOperations";
import {
  upsertStaff, deleteStaff, upsertShift, deleteShift,
  upsertPayRecord, deletePayRecord, upsertPayment,
} from "@/lib/opsRepo";
import { formatPHP, formatDate, todayISO, computeHours, generateReference, uid } from "../ops/opsUtils";
import type { StaffMember, Shift, PayRecord, PaymentMethod } from "@/types/cms";

const emptyStaff = (): StaffMember => ({
  id: uid("staff"), name: "", role: "", phone: "", email: "",
  payType: "daily", payRate: 500, active: true, hiredAt: todayISO(), notes: "",
});

export default function StaffManager() {
  const { data: ops, refresh } = useOperations();
  const { notify } = useToast();
  const [tab, setTab] = useState<"staff" | "schedule" | "pay">("staff");
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const staff = ops.staff;
  const shifts = ops.shifts;
  const payRecords = ops.payRecords;
  const activeStaff = staff.filter((s) => s.active);

  // KPIs
  const hoursThisWeek = shifts
    .filter((sh) => new Date(sh.date) > new Date(Date.now() - 7 * 86400000))
    .reduce((s, x) => s + x.hoursWorked, 0);
  const unpaidTotal = payRecords.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);

  const saveStaff = async (s: StaffMember) => {
    const exists = staff.some((x) => x.id === s.id);
    const ok = await upsertStaff(s);
    if (!ok) return notify("Could not save staff member", "info");
    await refresh();
    notify(exists ? "Staff updated" : "Staff added");
    setEditing(null);
  };

  const removeStaff = async (s: StaffMember) => {
    if (!window.confirm(`Remove ${s.name}? Shift & pay history will remain.`)) return;
    const ok = await deleteStaff(s.id);
    if (!ok) return notify("Could not remove staff member", "info");
    await refresh();
    notify("Staff removed");
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage team members, shift schedules and payroll."
        actions={tab === "staff" && <Button onClick={() => setEditing(emptyStaff())}><Plus className="h-4 w-4" /> Add Staff</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Active staff" value={String(activeStaff.length)} sub={`of ${staff.length} total`} />
        <KpiCard label="Hours this week" value={hoursThisWeek.toFixed(1)} />
        <KpiCard label="Shifts logged" value={String(shifts.length)} />
        <KpiCard label="Unpaid payroll" value={formatPHP(unpaidTotal)} tone={unpaidTotal > 0 ? "warning" : "positive"} />
      </div>

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "staff", label: "Team", count: staff.length },
          { id: "schedule", label: "Schedule", count: shifts.length },
          { id: "pay", label: "Pay Records", count: payRecords.length },
        ]}
      />

      {tab === "staff" && <StaffTab staff={staff} onEdit={setEditing} onRemove={removeStaff} />}
      {tab === "schedule" && <ScheduleTab staff={activeStaff} shifts={shifts} refresh={refresh} />}
      {tab === "pay" && <PayTab staff={activeStaff} shifts={shifts} payRecords={payRecords} refresh={refresh} />}

      {editing && <StaffModal member={editing} onClose={() => setEditing(null)} onSave={saveStaff} />}
    </div>
  );
}

function StaffTab({ staff, onEdit, onRemove }: { staff: StaffMember[]; onEdit: (s: StaffMember) => void; onRemove: (s: StaffMember) => void }) {
  if (staff.length === 0) return <EmptyState title="No staff yet" description="Add your first team member." />;
  return (
    <OpsTable>
      <thead>
        <tr>
          <OpsTH>Name</OpsTH>
          <OpsTH>Role</OpsTH>
          <OpsTH>Contact</OpsTH>
          <OpsTH>Pay Rate</OpsTH>
          <OpsTH>Status</OpsTH>
          <OpsTH>Hired</OpsTH>
          <OpsTH className="text-right">Actions</OpsTH>
        </tr>
      </thead>
      <tbody>
        {staff.map((s) => (
          <tr key={s.id} className="hover:bg-[#FAF6EF]/60">
            <OpsTD><span className="font-medium">{s.name}</span></OpsTD>
            <OpsTD>{s.role}</OpsTD>
            <OpsTD>
              <div className="text-xs">{s.phone}</div>
              <div className="text-xs text-[#26221C]/45">{s.email}</div>
            </OpsTD>
            <OpsTD>{formatPHP(s.payRate)} <span className="text-xs text-[#26221C]/50">/ {s.payType.replace("ly", "")}</span></OpsTD>
            <OpsTD><StatusPill value={s.active ? "active" : "returned"} /></OpsTD>
            <OpsTD className="text-xs text-[#26221C]/60">{formatDate(s.hiredAt)}</OpsTD>
            <OpsTD className="text-right">
              <div className="flex justify-end gap-1">
                <button onClick={() => onEdit(s)} className="rounded-md p-1.5 text-[#26221C]/50 hover:bg-[#26221C]/5">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => onRemove(s)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </OpsTD>
          </tr>
        ))}
      </tbody>
    </OpsTable>
  );
}

// ---- Schedule tab: quick shift entry + list --------------------------------
function ScheduleTab({ staff, shifts, refresh }: { staff: StaffMember[]; shifts: Shift[]; refresh: () => Promise<void> }) {
  const { notify } = useToast();
  const [staffId, setStaffId] = useState(staff[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStart] = useState("08:00");
  const [endTime, setEnd] = useState("17:00");
  const [notes, setNotes] = useState("");

  const addShift = async () => {
    if (!staffId || !date) return;
    const hoursWorked = computeHours(startTime, endTime);
    const shift: Shift = { id: uid("shift"), staffId, date, startTime, endTime, hoursWorked, notes };
    const ok = await upsertShift(shift);
    if (!ok) return notify("Could not log shift", "info");
    await refresh();
    notify(`Shift logged (${hoursWorked}h)`);
    setNotes("");
  };

  const removeShift = async (id: string) => {
    const ok = await deleteShift(id);
    if (!ok) return notify("Could not remove shift", "info");
    await refresh();
    notify("Shift removed");
  };

  const sorted = [...shifts].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || "—";

  return (
    <>
      <Card className="mb-6 p-5">
        <p className="mb-3 flex items-center gap-2 font-serif text-lg text-[#26221C]"><CalIcon className="h-4 w-4 text-[#C6A15B]" /> Log a Shift</p>
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Staff">
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">— Select —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Start"><Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={`End — ${computeHours(startTime, endTime)}h`}><Input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} /></Field>
          <div className="flex items-end"><Button onClick={addShift} disabled={!staffId} className="w-full"><Plus className="h-4 w-4" /> Add</Button></div>
        </div>
        <div className="mt-3">
          <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Front desk coverage during lunch" /></Field>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <EmptyState title="No shifts logged" description="Log your first shift above." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <OpsTH>Date</OpsTH>
              <OpsTH>Staff</OpsTH>
              <OpsTH>Time</OpsTH>
              <OpsTH>Hours</OpsTH>
              <OpsTH>Notes</OpsTH>
              <OpsTH className="text-right">&nbsp;</OpsTH>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((s) => (
              <tr key={s.id} className="hover:bg-[#FAF6EF]/60">
                <OpsTD>{formatDate(s.date)}</OpsTD>
                <OpsTD>{staffName(s.staffId)}</OpsTD>
                <OpsTD className="text-xs">{s.startTime}–{s.endTime}</OpsTD>
                <OpsTD><span className="font-medium">{s.hoursWorked}h</span></OpsTD>
                <OpsTD className="text-xs text-[#26221C]/60">{s.notes || "—"}</OpsTD>
                <OpsTD className="text-right">
                  <button onClick={() => removeShift(s.id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </OpsTD>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}

// ---- Pay tab: generate + mark paid --------------------------------------
function PayTab({
  staff, shifts, payRecords, refresh,
}: { staff: StaffMember[]; shifts: Shift[]; payRecords: PayRecord[]; refresh: () => Promise<void> }) {
  const { notify } = useToast();
  const [periodStart, setStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setEnd] = useState(todayISO());

  // For each active staff member, compute unbilled shifts in the period
  const summary = useMemo(() => {
    return staff.map((member) => {
      const memberShifts = shifts.filter((s) => s.staffId === member.id && s.date >= periodStart && s.date <= periodEnd);
      const hours = memberShifts.reduce((sum, s) => sum + s.hoursWorked, 0);
      const days = new Set(memberShifts.map((s) => s.date)).size;
      const amount =
        member.payType === "hourly" ? hours * member.payRate :
        member.payType === "daily" ? days * member.payRate :
        member.payRate; // monthly — full amount for the period
      return { member, hours, days, amount };
    });
  }, [staff, shifts, periodStart, periodEnd]);

  const generateAll = async () => {
    const created: PayRecord[] = summary
      .filter((s) => s.amount > 0)
      .map((s) => ({
        id: uid("pay"), staffId: s.member.id,
        periodStart, periodEnd, hours: s.hours, amount: s.amount,
        paid: false, paidAt: "", method: "cash", notes: "",
      }));
    if (created.length === 0) { notify("Nothing to pay in this period", "info"); return; }
    const results = await Promise.all(created.map(upsertPayRecord));
    if (results.some((ok) => !ok)) return notify("Could not generate all pay records", "info");
    await refresh();
    notify(`${created.length} pay record(s) generated`);
  };

  const markPaid = async (pr: PayRecord, method: PaymentMethod) => {
    const payRecordOk = await upsertPayRecord({ ...pr, paid: true, paidAt: todayISO(), method });
    const paymentOk = await upsertPayment({
      id: uid("pay"), reference: generateReference("SAL"),
      date: todayISO(), category: "expense", direction: "out",
      amount: pr.amount, method, relatedId: pr.id,
      description: `Salary: ${staff.find((s) => s.id === pr.staffId)?.name || "Staff"} (${pr.periodStart} → ${pr.periodEnd})`,
      notes: "",
    });
    if (!payRecordOk || !paymentOk) return notify("Could not mark as paid", "info");
    await refresh();
    notify("Marked paid");
  };

  const removeRecord = async (id: string) => {
    if (!window.confirm("Delete this pay record?")) return;
    const ok = await deletePayRecord(id);
    if (!ok) return notify("Could not delete record", "info");
    await refresh();
    notify("Deleted");
  };

  const sorted = [...payRecords].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  return (
    <>
      <Card className="mb-6 p-5">
        <p className="mb-3 flex items-center gap-2 font-serif text-lg text-[#26221C]"><DollarSign className="h-4 w-4 text-[#C6A15B]" /> Generate Payroll</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Period Start"><Input type="date" value={periodStart} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Period End"><Input type="date" value={periodEnd} onChange={(e) => setEnd(e.target.value)} /></Field>
          <div className="flex items-end"><Button onClick={generateAll} className="w-full">Generate All</Button></div>
        </div>
        {summary.length > 0 && (
          <div className="admin-scroll mt-4 overflow-x-auto rounded-lg bg-[#FAF6EF] p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[#26221C]/50">
                  <th className="pb-2">Staff</th><th>Days</th><th>Hours</th><th>Rate</th><th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.member.id} className="border-t border-[#26221C]/10">
                    <td className="py-2">{s.member.name}</td>
                    <td>{s.days}</td>
                    <td>{s.hours.toFixed(1)}h</td>
                    <td className="text-xs text-[#26221C]/60">{formatPHP(s.member.payRate)}/{s.member.payType.replace("ly", "")}</td>
                    <td className="text-right font-medium">{formatPHP(s.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#26221C]/20 font-medium">
                  <td className="pt-2" colSpan={4}>Total</td>
                  <td className="pt-2 text-right">{formatPHP(summary.reduce((s, x) => s + x.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {sorted.length === 0 ? (
        <EmptyState title="No pay records" description="Generate payroll for a period above." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <OpsTH>Staff</OpsTH>
              <OpsTH>Period</OpsTH>
              <OpsTH>Hours</OpsTH>
              <OpsTH>Amount</OpsTH>
              <OpsTH>Status</OpsTH>
              <OpsTH className="text-right">Actions</OpsTH>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const s = staff.find((x) => x.id === p.staffId);
              return (
                <tr key={p.id} className="hover:bg-[#FAF6EF]/60">
                  <OpsTD className="font-medium">{s?.name || "—"}</OpsTD>
                  <OpsTD className="text-xs">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</OpsTD>
                  <OpsTD>{p.hours.toFixed(1)}h</OpsTD>
                  <OpsTD className="font-medium">{formatPHP(p.amount)}</OpsTD>
                  <OpsTD>
                    {p.paid ? (
                      <div className="flex flex-col">
                        <StatusPill value="paid" />
                        <span className="mt-0.5 text-[10px] text-[#26221C]/45">{formatDate(p.paidAt)} · {p.method}</span>
                      </div>
                    ) : <StatusPill value="unpaid" />}
                  </OpsTD>
                  <OpsTD className="text-right">
                    <div className="flex justify-end gap-1">
                      {!p.paid && (
                        <>
                          <button onClick={() => markPaid(p, "cash")} className="rounded-md bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200">
                            <Check className="inline h-3 w-3" /> Cash
                          </button>
                          <button onClick={() => markPaid(p, "gcash")} className="rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">
                            GCash
                          </button>
                        </>
                      )}
                      <button onClick={() => removeRecord(p.id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </OpsTD>
                </tr>
              );
            })}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}

function StaffModal({ member, onClose, onSave }: { member: StaffMember; onClose: () => void; onSave: (s: StaffMember) => void }) {
  const [d, setD] = useState<StaffMember>(member);
  const patch = (p: Partial<StaffMember>) => setD((x) => ({ ...x, ...p }));
  return (
    <Modal open onClose={onClose} title={member.name ? `Edit ${member.name}` : "Add Staff Member"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full Name"><Input value={d.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Role / Position"><Input value={d.role} onChange={(e) => patch({ role: e.target.value })} placeholder="e.g. Front Desk" /></Field>
          <Field label="Phone / WhatsApp"><Input value={d.phone} onChange={(e) => patch({ phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={d.email} onChange={(e) => patch({ email: e.target.value })} /></Field>
          <Field label="Pay Type">
            <Select value={d.payType} onChange={(e) => patch({ payType: e.target.value as any })}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </Select>
          </Field>
          <Field label={`Pay Rate (PHP per ${d.payType.replace("ly", "")})`}>
            <Input type="number" value={d.payRate} onChange={(e) => patch({ payRate: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Hired Date"><Input type="date" value={d.hiredAt} onChange={(e) => patch({ hiredAt: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={d.active} onChange={(v) => patch({ active: v })} /> Active
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(d)} disabled={!d.name.trim()}>Save</Button>
      </div>
    </Modal>
  );
}
