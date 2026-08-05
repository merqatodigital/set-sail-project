import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Bike, CircleDollarSign, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Select, Modal, Switch } from "@/components/ui";
import { PageHeader, EmptyState, TabBar } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { useOperations } from "../ops/useOperations";
import { upsertMotorbike, deleteMotorbike, upsertMotorbikeRental, deleteMotorbikeRental, upsertPayment } from "@/lib/opsRepo";
import { formatPHP, formatDate, todayISO, nightsBetween, generateReference, textSearch, uid } from "../ops/opsUtils";
import type { Motorbike, MotorbikeRental } from "@/types/cms";

const emptyBike = (): Motorbike => ({
  id: uid("bike"), name: "", plate: "", model: "", dailyRate: 500,
  active: true, status: "available", notes: "",
});
const emptyRental = (bike?: Motorbike): MotorbikeRental => ({
  id: uid("rent"), reference: generateReference("BK"),
  bikeId: bike?.id || "", bikeName: bike?.name || "",
  guestName: "", guestPhone: "",
  startDate: todayISO(), endDate: "", days: 0,
  amount: 0, paidAmount: 0, deposit: 0,
  status: "active", notes: "", createdAt: new Date().toISOString(),
});

export default function RentalsManager() {
  const { data: ops, refresh } = useOperations();
  const { notify } = useToast();
  const [tab, setTab] = useState<"rentals" | "fleet">("rentals");
  const [editBike, setEditBike] = useState<Motorbike | null>(null);
  const [editRental, setEditRental] = useState<MotorbikeRental | null>(null);
  const [search, setSearch] = useState("");

  const bikes = ops.motorbikes;
  const rentals = ops.motorbikeRentals;
  const availableBikes = bikes.filter((b) => b.active && b.status === "available");

  // KPIs
  const activeRentals = rentals.filter((r) => r.status === "active").length;
  const revenue30 = rentals
    .filter((r) => new Date(r.createdAt) > new Date(Date.now() - 30 * 86400000))
    .reduce((s, r) => s + r.paidAmount, 0);
  const utilization = bikes.length > 0 ? Math.round((bikes.filter((b) => b.status === "rented").length / bikes.length) * 100) : 0;

  const saveBike = async (b: Motorbike) => {
    const exists = bikes.some((x) => x.id === b.id);
    const ok = await upsertMotorbike(b);
    if (!ok) return notify("Could not save bike", "info");
    await refresh();
    notify(exists ? "Bike updated" : "Bike added to fleet");
    setEditBike(null);
  };

  const removeBike = async (b: Motorbike) => {
    if (!window.confirm(`Remove ${b.name} from fleet?`)) return;
    const ok = await deleteMotorbike(b.id);
    if (!ok) return notify("Could not remove bike", "info");
    await refresh();
    notify("Bike removed");
  };

  const saveRental = async (r: MotorbikeRental) => {
    const exists = rentals.some((x) => x.id === r.id);
    r.days = nightsBetween(r.startDate, r.endDate) || 1;
    const rentalOk = await upsertMotorbikeRental(r);
    // If new active rental, mark bike as rented
    let bikeOk = true;
    if (!exists && r.status === "active") {
      const bike = bikes.find((b) => b.id === r.bikeId);
      if (bike) bikeOk = await upsertMotorbike({ ...bike, status: "rented" });
    }
    if (!rentalOk || !bikeOk) return notify("Could not save rental", "info");
    await refresh();
    notify(exists ? "Rental updated" : `Rental ${r.reference} created`);
    setEditRental(null);
  };

  const returnBike = async (r: MotorbikeRental) => {
    if (!window.confirm(`Mark rental ${r.reference} as returned?`)) return;
    const bike = bikes.find((b) => b.id === r.bikeId);
    const rentalOk = await upsertMotorbikeRental({ ...r, status: "returned" });
    const bikeOk = bike ? await upsertMotorbike({ ...bike, status: "available" }) : true;
    if (!rentalOk || !bikeOk) return notify("Could not return bike", "info");
    await refresh();
    notify("Bike returned & available");
  };

  const removeRental = async (r: MotorbikeRental) => {
    if (!window.confirm(`Delete rental ${r.reference}?`)) return;
    const ok = await deleteMotorbikeRental(r.id);
    if (!ok) return notify("Could not delete rental", "info");
    await refresh();
    notify("Rental deleted");
  };

  const recordPayment = async (r: MotorbikeRental) => {
    const owed = r.amount - r.paidAmount;
    const raw = window.prompt(`Payment for ${r.reference}\nOutstanding: ${formatPHP(owed)}\nAmount:`, String(owed));
    if (!raw) return;
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) return;
    const rentalOk = await upsertMotorbikeRental({ ...r, paidAmount: r.paidAmount + amt });
    const paymentOk = await upsertPayment({
      id: uid("pay"), reference: generateReference("PAY"),
      date: todayISO(), category: "rental", direction: "in",
      amount: amt, method: "cash", relatedId: r.id,
      description: `Rental: ${r.bikeName} — ${r.guestName}`, notes: "",
    });
    if (!rentalOk || !paymentOk) return notify("Could not record payment", "info");
    await refresh();
    notify(`${formatPHP(amt)} recorded`);
  };

  const filteredRentals = useMemo(() =>
    textSearch(rentals, search, ["guestName", "reference", "bikeName"])
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  , [rentals, search]);

  return (
    <div>
      <PageHeader
        title="Motorbike Rentals"
        description="Manage your rental fleet and guest bookings."
        actions={
          tab === "rentals" ? (
            <Button onClick={() => setEditRental(emptyRental(availableBikes[0]))} disabled={availableBikes.length === 0}>
              <Plus className="h-4 w-4" /> New Rental
            </Button>
          ) : (
            <Button onClick={() => setEditBike(emptyBike())}><Plus className="h-4 w-4" /> Add Bike</Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Active rentals" value={String(activeRentals)} tone={activeRentals ? "positive" : "default"} />
        <KpiCard label="Available bikes" value={String(availableBikes.length)} sub={`of ${bikes.length} total`} />
        <KpiCard label="Utilization" value={`${utilization}%`} />
        <KpiCard label="Revenue (30d)" value={formatPHP(revenue30)} tone="positive" />
      </div>

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "rentals", label: "Rentals", count: rentals.length },
          { id: "fleet", label: "Fleet", count: bikes.length },
        ]}
      />

      {tab === "rentals" && (
        <>
          <div className="mb-4 relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {filteredRentals.length === 0 ? (
            <EmptyState title="No rentals yet" description="Create your first rental." />
          ) : (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Reference</OpsTH>
                  <OpsTH>Bike</OpsTH>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Dates</OpsTH>
                  <OpsTH>Amount</OpsTH>
                  <OpsTH>Status</OpsTH>
                  <OpsTH className="text-right">Actions</OpsTH>
                </tr>
              </thead>
              <tbody>
                {filteredRentals.map((r) => {
                  const owed = r.amount - r.paidAmount;
                  return (
                    <tr key={r.id} className="hover:bg-[#FAF6EF]/60">
                      <OpsTD><span className="font-mono text-xs text-[#26221C]/60">{r.reference}</span></OpsTD>
                      <OpsTD>
                        <div className="font-medium">{r.bikeName}</div>
                      </OpsTD>
                      <OpsTD>
                        <div className="font-medium">{r.guestName}</div>
                        <div className="text-xs text-[#26221C]/45">{r.guestPhone}</div>
                      </OpsTD>
                      <OpsTD>
                        <div className="text-xs">{formatDate(r.startDate)} → {formatDate(r.endDate)}</div>
                        <div className="text-[10px] text-[#26221C]/45">{r.days} day{r.days !== 1 ? "s" : ""}</div>
                      </OpsTD>
                      <OpsTD>
                        <div className="font-medium">{formatPHP(r.amount)}</div>
                        <div className={`text-xs ${owed > 0 ? "text-red-600" : "text-green-700"}`}>
                          {owed > 0 ? `${formatPHP(owed)} owed` : "Paid"}
                        </div>
                        {r.deposit > 0 && <div className="text-[10px] text-[#26221C]/45">Deposit: {formatPHP(r.deposit)}</div>}
                      </OpsTD>
                      <OpsTD><StatusPill value={r.status} /></OpsTD>
                      <OpsTD className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.status === "active" && (
                            <button onClick={() => returnBike(r)} className="rounded-md p-1.5 text-green-600 hover:bg-green-50" title="Return">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {owed > 0 && (
                            <button onClick={() => recordPayment(r)} className="rounded-md p-1.5 text-[#C6A15B] hover:bg-[#C6A15B]/10" title="Record payment">
                              <CircleDollarSign className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setEditRental(r)} className="rounded-md p-1.5 text-[#26221C]/50 hover:bg-[#26221C]/5">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeRental(r)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50">
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
        </>
      )}

      {tab === "fleet" && (
        <>
          {bikes.length === 0 ? (
            <EmptyState title="No bikes in fleet" description="Add your first motorbike." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bikes.map((b) => (
                <Card key={b.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bike className="h-4 w-4 text-[#C6A15B]" />
                        <h3 className="font-serif text-base text-[#26221C]">{b.name}</h3>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-[#26221C]/50">{b.plate}</p>
                    </div>
                    <StatusPill value={b.status} />
                  </div>
                  <p className="text-xs text-[#26221C]/60">{b.model}</p>
                  <div className="mt-3 flex items-baseline justify-between border-t border-[#26221C]/10 pt-3">
                    <span className="text-[10px] uppercase tracking-wide text-[#26221C]/45">Daily rate</span>
                    <span className="font-serif text-lg text-[#26221C]">{formatPHP(b.dailyRate)}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditBike(b)}>Edit</Button>
                    <button onClick={() => removeBike(b)} className="rounded-md p-2 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {editBike && <BikeModal bike={editBike} onClose={() => setEditBike(null)} onSave={saveBike} />}
      {editRental && <RentalModal rental={editRental} bikes={bikes} onClose={() => setEditRental(null)} onSave={saveRental} />}
    </div>
  );
}

function BikeModal({ bike, onClose, onSave }: { bike: Motorbike; onClose: () => void; onSave: (b: Motorbike) => void }) {
  const [d, setD] = useState<Motorbike>(bike);
  const patch = (p: Partial<Motorbike>) => setD((x) => ({ ...x, ...p }));
  return (
    <Modal open onClose={onClose} title={bike.name ? "Edit Bike" : "Add Bike"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name / Nickname"><Input value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Honda Click 125 #1" /></Field>
          <Field label="Plate Number"><Input value={d.plate} onChange={(e) => patch({ plate: e.target.value })} /></Field>
          <Field label="Model"><Input value={d.model} onChange={(e) => patch({ model: e.target.value })} /></Field>
          <Field label="Daily Rate (PHP)"><Input type="number" value={d.dailyRate} onChange={(e) => patch({ dailyRate: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Status">
            <Select value={d.status} onChange={(e) => patch({ status: e.target.value as any })}>
              <option value="available">Available</option>
              <option value="rented">Rented</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={d.active} onChange={(v) => patch({ active: v })} /> Active in fleet
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(d)} disabled={!d.name.trim()}>Save</Button>
      </div>
    </Modal>
  );
}

function RentalModal({ rental, bikes, onClose, onSave }: { rental: MotorbikeRental; bikes: Motorbike[]; onClose: () => void; onSave: (r: MotorbikeRental) => void }) {
  const [d, setD] = useState<MotorbikeRental>(rental);
  const patch = (p: Partial<MotorbikeRental>) => setD((x) => ({ ...x, ...p }));
  const days = nightsBetween(d.startDate, d.endDate) || 1;
  const owed = d.amount - d.paidAmount;
  const selectedBike = bikes.find((b) => b.id === d.bikeId);
  const availableBikes = bikes.filter((b) => b.id === d.bikeId || (b.active && b.status === "available"));
  return (
    <Modal open onClose={onClose} title={rental.guestName ? "Edit Rental" : "New Rental"} wide>
      <div className="space-y-4">
        <Field label="Motorbike">
          <Select value={d.bikeId} onChange={(e) => {
            const b = bikes.find((x) => x.id === e.target.value);
            if (b) patch({ bikeId: b.id, bikeName: b.name, amount: b.dailyRate * days });
          }}>
            <option value="">— Select bike —</option>
            {availableBikes.map((b) => <option key={b.id} value={b.id}>{b.name} — {formatPHP(b.dailyRate)}/day</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guest Name"><Input value={d.guestName} onChange={(e) => patch({ guestName: e.target.value })} /></Field>
          <Field label="Phone / WhatsApp"><Input value={d.guestPhone} onChange={(e) => patch({ guestPhone: e.target.value })} /></Field>
          <Field label="Start Date"><Input type="date" value={d.startDate} onChange={(e) => {
            const nd = { startDate: e.target.value };
            patch(nd);
          }} /></Field>
          <Field label={`End Date — ${days} day${days !== 1 ? "s" : ""}`}>
            <Input type="date" value={d.endDate} onChange={(e) => {
              const newDays = nightsBetween(d.startDate, e.target.value) || 1;
              patch({ endDate: e.target.value, amount: selectedBike ? selectedBike.dailyRate * newDays : d.amount });
            }} />
          </Field>
          <Field label="Total (PHP)"><Input type="number" value={d.amount} onChange={(e) => patch({ amount: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label={`Paid — ${owed > 0 ? formatPHP(owed) + " owed" : "Paid in full"}`}>
            <Input type="number" value={d.paidAmount} onChange={(e) => patch({ paidAmount: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Deposit / Security (PHP)">
            <Input type="number" value={d.deposit} onChange={(e) => patch({ deposit: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Status">
            <Select value={d.status} onChange={(e) => patch({ status: e.target.value as any })}>
              <option value="active">Active</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="ID collected, helmet count, damages, etc." /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(d)} disabled={!d.bikeId || !d.guestName.trim()}>Save Rental</Button>
      </div>
    </Modal>
  );
}
