import { useState } from "react";
import { useCms } from "@/context/CmsContext";
import { uid, generateReference } from "@/admin/ops/opsUtils";
import type { Motorbike } from "@/types/cms";
import type { PortalBookingResult } from "@/pages/Portal";

// ---------------------------------------------------------------------------
// Rent Motorbike — select bike, set dates, confirm rental.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  guest: { phone: string; name: string };
  motorbikes: Motorbike[];
  onComplete: (result: PortalBookingResult) => void;
  onBack: () => void;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export default function RentMotorbike({ guest, motorbikes, onComplete, onBack }: Props) {
  const { update } = useCms();
  const [selectedBike, setSelectedBike] = useState<Motorbike | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [confirmed, setConfirmed] = useState(false);

  const days = selectedBike && startDate && endDate ? daysBetween(startDate, endDate) : 1;
  const total = selectedBike ? selectedBike.dailyRate * days : 0;

  const handleConfirm = () => {
    if (!selectedBike) return;

    const rental = {
      id: uid("bk"),
      reference: generateReference("BK"),
      bikeId: selectedBike.id,
      bikeName: selectedBike.name,
      guestName: guest.name,
      guestPhone: guest.phone,
      startDate,
      endDate,
      days,
      amount: total,
      paidAmount: 0,
      deposit: 0,
      status: "active" as const,
      notes: `Booked via Guest Portal. Pay on-site or GCash.`,
      createdAt: new Date().toISOString(),
    };

    const payment = {
      id: uid("pay"),
      reference: generateReference("PY"),
      date: new Date().toISOString().slice(0, 10),
      category: "rental" as const,
      direction: "in" as const,
      amount: total,
      method: "gcash" as const,
      relatedId: rental.id,
      description: `Rental: ${selectedBike.name} for ${guest.name} (${days} day${days > 1 ? "s" : ""})`,
      notes: "",
    };

    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        motorbikeRentals: [...d.operations.motorbikeRentals, rental],
        motorbikes: d.operations.motorbikes.map((m) =>
          m.id === selectedBike.id ? { ...m, status: "rented" as const } : m,
        ),
        payments: [...d.operations.payments, payment],
      },
    }));

    setConfirmed(true);

    onComplete({
      type: "rental",
      reference: rental.reference,
      name: selectedBike.name,
      date: startDate,
      amount: total,
      days,
    });
  };

  if (confirmed) return null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <span>{"\u2190"}</span> Back
      </button>

      <h1 className="text-xl font-semibold">Rent a Motorbike</h1>

      {/* Bike Cards */}
      {!selectedBike && (
        <div className="space-y-3">
          {motorbikes.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: DARK_CARD }}>
              <p className="opacity-50">No motorbikes available right now.</p>
            </div>
          ) : (
            motorbikes.map((bike) => (
              <button
                key={bike.id}
                onClick={() => setSelectedBike(bike)}
                className="w-full rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:p-4"
                style={{ backgroundColor: DARK_CARD }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{bike.name}</h3>
                    <p className="mt-1 text-xs opacity-50">{bike.model} — {bike.plate}</p>
                    <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: "#1F3D2B44", color: "#4ade80" }}>
                      Available
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold" style={{ color: GOLD }}>
                      {"\u20B1"}{bike.dailyRate.toLocaleString()}
                    </p>
                    <p className="text-[10px] opacity-40">per day</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Rental Form */}
      {selectedBike && (
        <div className="space-y-4 rounded-xl p-4 shadow-lg sm:rounded-2xl sm:p-5" style={{ backgroundColor: DARK_CARD }}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{selectedBike.name}</h2>
            <button
              onClick={() => setSelectedBike(null)}
              className="text-xs underline opacity-50"
            >
              Change
            </button>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide opacity-50">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value >= endDate) {
                    const next = new Date(e.target.value);
                    next.setDate(next.getDate() + 1);
                    setEndDate(next.toISOString().slice(0, 10));
                  }
                }}
                className="w-full rounded-lg border px-3 py-3 text-sm focus:outline-none"
                style={{
                  backgroundColor: "#0f3460",
                  borderColor: `${GOLD}44`,
                  color: "#e8e8e8",
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide opacity-50">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-3 text-sm focus:outline-none"
                style={{
                  backgroundColor: "#0f3460",
                  borderColor: `${GOLD}44`,
                  color: "#e8e8e8",
                }}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="text-center">
            <span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>
              {days} day{days > 1 ? "s" : ""}
            </span>
          </div>

          {/* Price Summary */}
          <div className="border-t pt-4" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">
                {"\u20B1"}{selectedBike.dailyRate.toLocaleString()} x {days} day{days > 1 ? "s" : ""}
              </span>
              <span>{"\u20B1"}{total.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span style={{ color: GOLD }}>{"\u20B1"}{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Guest Info */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "#0f346022" }}>
            <p className="text-xs opacity-50">Rental for</p>
            <p className="text-sm font-medium">{guest.name}</p>
            <p className="text-xs opacity-50">{guest.phone}</p>
          </div>

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            className="w-full rounded-lg py-3 text-sm font-medium transition"
            style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
          >
            Confirm Rental
          </button>
        </div>
      )}
    </div>
  );
}
