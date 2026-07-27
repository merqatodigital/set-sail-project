import { useState } from "react";
import { Plus, Trash2, Pencil, Ship, Users, Search, CircleDollarSign } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Select, Modal, Switch } from "@/components/ui";
import { PageHeader, EmptyState, TabBar } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { useOperations } from "../ops/useOperations";
import { upsertTour, deleteTour, upsertTourBooking, deleteTourBooking, upsertPayment } from "@/lib/opsRepo";
import { formatPHP, formatDate, todayISO, generateReference, textSearch, uid } from "../ops/opsUtils";
import type { Tour, TourBooking } from "@/types/cms";

const emptyTour = (order: number): Tour => ({
  id: uid("tour"), name: "", description: "", duration: "8 hours",
  price: 0, capacity: 10, inclusions: [], active: true, order,
});
const emptyTourBooking = (tourId = "", tourName = ""): TourBooking => ({
  id: uid("tb"), reference: generateReference("TR"), tourId, tourName,
  guestName: "", guestPhone: "", date: todayISO(), guests: 1,
  amount: 0, paidAmount: 0, status: "confirmed", notes: "", createdAt: new Date().toISOString(),
});

export default function ToursManager() {
  const { data: ops, refresh } = useOperations();
  const { notify } = useToast();
  const [tab, setTab] = useState<"tours" | "bookings">("bookings");
  const [editTour, setEditTour] = useState<Tour | null>(null);
  const [editBooking, setEditBooking] = useState<TourBooking | null>(null);
  const [search, setSearch] = useState("");

  const tours = [...ops.tours].sort((a, b) => a.order - b.order);
  const bookings = ops.tourBookings;
  const activeTours = tours.filter((t) => t.active);

  // KPIs
  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.date >= todayISO()).length;
  const guests30 = bookings
    .filter((b) => new Date(b.date) > new Date(Date.now() - 30 * 86400000))
    .reduce((s, b) => s + b.guests, 0);
  const revenue30 = bookings
    .filter((b) => new Date(b.date) > new Date(Date.now() - 30 * 86400000))
    .reduce((s, b) => s + b.paidAmount, 0);

  const saveTour = async (t: Tour) => {
    const exists = tours.some((x) => x.id === t.id);
    const ok = await upsertTour(t);
    if (!ok) return notify("Could not save tour", "info");
    await refresh();
    notify(exists ? "Tour updated" : "Tour created");
    setEditTour(null);
  };

  const removeTour = async (t: Tour) => {
    if (!window.confirm(`Delete "${t.name}"?`)) return;
    const ok = await deleteTour(t.id);
    if (!ok) return notify("Could not delete tour", "info");
    await refresh();
    notify("Tour deleted");
  };

  const saveBooking = async (b: TourBooking) => {
    const exists = bookings.some((x) => x.id === b.id);
    const ok = await upsertTourBooking(b);
    if (!ok) return notify("Could not save booking", "info");
    await refresh();
    notify(exists ? "Tour booking updated" : "Tour booking created");
    setEditBooking(null);
  };

  const removeBooking = async (b: TourBooking) => {
    if (!window.confirm(`Delete tour booking ${b.reference}?`)) return;
    const ok = await deleteTourBooking(b.id);
    if (!ok) return notify("Could not delete booking", "info");
    await refresh();
    notify("Booking deleted");
  };

  const recordPayment = async (b: TourBooking) => {
    const owed = b.amount - b.paidAmount;
    const raw = window.prompt(`Payment for ${b.reference}\nOutstanding: ${formatPHP(owed)}\nAmount:`, String(owed));
    if (!raw) return;
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) return;
    const bookingOk = await upsertTourBooking({ ...b, paidAmount: b.paidAmount + amt });
    const paymentOk = await upsertPayment({
      id: uid("pay"), reference: generateReference("PAY"),
      date: todayISO(), category: "tour", direction: "in",
      amount: amt, method: "cash", relatedId: b.id,
      description: `Tour payment: ${b.tourName} — ${b.guestName}`, notes: "",
    });
    if (!bookingOk || !paymentOk) return notify("Could not record payment", "info");
    await refresh();
    notify(`${formatPHP(amt)} recorded`);
  };

  const filteredBookings = textSearch(bookings, search, ["guestName", "reference", "tourName"])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <PageHeader
        title="Tours & Island Hopping"
        description="Manage your tour catalog and guest bookings."
        actions={
          tab === "bookings" ? (
            <Button onClick={() => setEditBooking(emptyTourBooking(activeTours[0]?.id, activeTours[0]?.name))} disabled={activeTours.length === 0}>
              <Plus className="h-4 w-4" /> New Booking
            </Button>
          ) : (
            <Button onClick={() => setEditTour(emptyTour(tours.length))}><Plus className="h-4 w-4" /> New Tour</Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Upcoming tours" value={String(upcoming)} tone={upcoming ? "positive" : "default"} />
        <KpiCard label="Guests (30d)" value={String(guests30)} />
        <KpiCard label="Revenue (30d)" value={formatPHP(revenue30)} tone="positive" />
        <KpiCard label="Active tours" value={String(activeTours.length)} sub={`of ${tours.length} total`} />
      </div>

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "bookings", label: "Bookings", count: bookings.length },
          { id: "tours", label: "Tour Catalog", count: tours.length },
        ]}
      />

      {tab === "bookings" && (
        <>
          <div className="mb-4 relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {filteredBookings.length === 0 ? (
            <EmptyState title="No tour bookings" description="Create your first booking." />
          ) : (
            <OpsTable>
              <thead>
                <tr>
                  <OpsTH>Reference</OpsTH>
                  <OpsTH>Tour</OpsTH>
                  <OpsTH>Guest</OpsTH>
                  <OpsTH>Date</OpsTH>
                  <OpsTH>Guests</OpsTH>
                  <OpsTH>Amount</OpsTH>
                  <OpsTH>Status</OpsTH>
                  <OpsTH className="text-right">Actions</OpsTH>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => {
                  const owed = b.amount - b.paidAmount;
                  return (
                    <tr key={b.id} className="hover:bg-[#FAF6EF]/60">
                      <OpsTD><span className="font-mono text-xs text-[#26221C]/60">{b.reference}</span></OpsTD>
                      <OpsTD className="max-w-[200px] truncate">{b.tourName}</OpsTD>
                      <OpsTD>
                        <div className="font-medium">{b.guestName}</div>
                        <div className="text-xs text-[#26221C]/45">{b.guestPhone}</div>
                      </OpsTD>
                      <OpsTD>{formatDate(b.date)}</OpsTD>
                      <OpsTD>{b.guests}</OpsTD>
                      <OpsTD>
                        <div className="font-medium">{formatPHP(b.amount)}</div>
                        <div className={`text-xs ${owed > 0 ? "text-red-600" : "text-green-700"}`}>
                          {owed > 0 ? `${formatPHP(owed)} owed` : "Paid"}
                        </div>
                      </OpsTD>
                      <OpsTD><StatusPill value={b.status} /></OpsTD>
                      <OpsTD className="text-right">
                        <div className="flex justify-end gap-1">
                          {owed > 0 && (
                            <button onClick={() => recordPayment(b)} className="rounded-md p-1.5 text-[#C6A15B] hover:bg-[#C6A15B]/10">
                              <CircleDollarSign className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setEditBooking(b)} className="rounded-md p-1.5 text-[#26221C]/50 hover:bg-[#26221C]/5">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeBooking(b)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50">
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

      {tab === "tours" && (
        <>
          {tours.length === 0 ? (
            <EmptyState title="No tours yet" description="Add your first tour." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tours.map((t) => (
                <Card key={t.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Ship className="h-4 w-4 text-[#C6A15B]" />
                        <h3 className="font-serif text-lg text-[#26221C]">{t.name || "Untitled Tour"}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-[#26221C]/45">{t.duration}</p>
                    </div>
                    <StatusPill value={t.active ? "active" : "returned"} className={t.active ? "" : "opacity-60"} />
                  </div>
                  <p className="text-sm text-[#26221C]/65">{t.description}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#26221C]/10 pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#26221C]/40">Price / pax</p>
                      <p className="font-serif text-lg text-[#26221C]">{formatPHP(t.price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#26221C]/40">Capacity</p>
                      <p className="flex items-center gap-1 font-serif text-lg text-[#26221C]"><Users className="h-4 w-4" />{t.capacity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#26221C]/40">Inclusions</p>
                      <p className="text-xs text-[#26221C]/60">{t.inclusions.length}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditTour(t)}>Edit</Button>
                    <button onClick={() => removeTour(t)} className="rounded-md p-2 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {editTour && <TourModal tour={editTour} onClose={() => setEditTour(null)} onSave={saveTour} />}
      {editBooking && <TourBookingModal booking={editBooking} tours={activeTours} onClose={() => setEditBooking(null)} onSave={saveBooking} />}
    </div>
  );
}

function TourModal({ tour, onClose, onSave }: { tour: Tour; onClose: () => void; onSave: (t: Tour) => void }) {
  const [d, setD] = useState<Tour>(tour);
  const patch = (p: Partial<Tour>) => setD((x) => ({ ...x, ...p }));
  return (
    <Modal open onClose={onClose} title={tour.name ? "Edit Tour" : "New Tour"} wide>
      <div className="space-y-4">
        <Field label="Tour Name"><Input value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Long Beach Island Hopping" /></Field>
        <Field label="Description"><Textarea rows={2} value={d.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Duration"><Input value={d.duration} onChange={(e) => patch({ duration: e.target.value })} placeholder="8 hours" /></Field>
          <Field label="Price / pax (PHP)"><Input type="number" value={d.price} onChange={(e) => patch({ price: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Capacity"><Input type="number" value={d.capacity} onChange={(e) => patch({ capacity: parseInt(e.target.value) || 1 })} /></Field>
        </div>
        <Field label="Inclusions (comma-separated)">
          <Input value={d.inclusions.join(", ")} onChange={(e) => patch({ inclusions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={d.active} onChange={(v) => patch({ active: v })} /> Active — available for booking
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(d)} disabled={!d.name.trim()}>Save Tour</Button>
      </div>
    </Modal>
  );
}

function TourBookingModal({ booking, tours, onClose, onSave }: { booking: TourBooking; tours: Tour[]; onClose: () => void; onSave: (b: TourBooking) => void }) {
  const [d, setD] = useState<TourBooking>(booking);
  const patch = (p: Partial<TourBooking>) => setD((x) => ({ ...x, ...p }));
  const selectedTour = tours.find((t) => t.id === d.tourId);
  const owed = d.amount - d.paidAmount;
  return (
    <Modal open onClose={onClose} title={booking.guestName ? "Edit Tour Booking" : "New Tour Booking"} wide>
      <div className="space-y-4">
        <Field label="Tour">
          <Select value={d.tourId} onChange={(e) => {
            const t = tours.find((x) => x.id === e.target.value);
            if (t) patch({ tourId: t.id, tourName: t.name, amount: t.price * d.guests });
          }}>
            <option value="">— Select tour —</option>
            {tours.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatPHP(t.price)}/pax</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guest Name"><Input value={d.guestName} onChange={(e) => patch({ guestName: e.target.value })} /></Field>
          <Field label="Phone / WhatsApp"><Input value={d.guestPhone} onChange={(e) => patch({ guestPhone: e.target.value })} /></Field>
          <Field label="Tour Date"><Input type="date" value={d.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
          <Field label="Number of Guests">
            <Input type="number" min={1} value={d.guests} onChange={(e) => {
              const n = parseInt(e.target.value) || 1;
              patch({ guests: n, amount: selectedTour ? selectedTour.price * n : d.amount });
            }} />
          </Field>
          <Field label="Total (PHP)"><Input type="number" value={d.amount} onChange={(e) => patch({ amount: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label={`Paid — ${owed > 0 ? formatPHP(owed) + " owed" : "Paid in full"}`}>
            <Input type="number" value={d.paidAmount} onChange={(e) => patch({ paidAmount: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Status">
            <Select value={d.status} onChange={(e) => patch({ status: e.target.value as any })}>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-[#26221C]/10 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(d)} disabled={!d.tourId || !d.guestName.trim()}>Save Booking</Button>
      </div>
    </Modal>
  );
}
