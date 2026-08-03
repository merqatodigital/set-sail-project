import { useState } from "react";
import { useCms } from "@/context/CmsContext";
import { uid, generateReference } from "@/admin/ops/opsUtils";
import type { Tour } from "@/types/cms";
import type { PortalBookingResult } from "@/pages/Portal";

// ---------------------------------------------------------------------------
// Book Experiences — select tour, set pax, confirm booking.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";
const GREEN = "#1F3D2B";

interface Props {
  guest: { phone: string; name: string };
  tours: Tour[];
  onComplete: (result: PortalBookingResult) => void;
  onBack: () => void;
}

export default function BookExperiences({ guest, tours, onComplete, onBack }: Props) {
  const { update } = useCms();
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [confirmed, setConfirmed] = useState(false);

  const total = selectedTour ? selectedTour.price * pax : 0;

  const handleConfirm = () => {
    if (!selectedTour) return;

    const booking = {
      id: uid("tb"),
      reference: generateReference("TR"),
      tourId: selectedTour.id,
      tourName: selectedTour.name,
      guestName: guest.name,
      guestPhone: guest.phone,
      date,
      guests: pax,
      amount: total,
      paidAmount: 0,
      status: "confirmed" as const,
      notes: `Booked via Guest Portal. Pay on-site or GCash.`,
      createdAt: new Date().toISOString(),
    };

    const payment = {
      id: uid("pay"),
      reference: generateReference("PY"),
      date: new Date().toISOString().slice(0, 10),
      category: "tour" as const,
      direction: "in" as const,
      amount: total,
      method: "gcash" as const,
      relatedId: booking.id,
      description: `Tour: ${selectedTour.name} for ${guest.name} (${pax} pax)`,
      notes: "",
    };

    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        tourBookings: [...d.operations.tourBookings, booking],
        payments: [...d.operations.payments, payment],
      },
    }));

    setConfirmed(true);

    onComplete({
      type: "tour",
      reference: booking.reference,
      name: selectedTour.name,
      date,
      amount: total,
      pax,
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

      <h1 className="text-xl font-semibold">Book Experiences</h1>

      {/* Tour Cards */}
      {!selectedTour && (
        <div className="space-y-3">
          {tours.map((tour) => (
            <button
              key={tour.id}
              onClick={() => setSelectedTour(tour)}
              className="w-full rounded-xl p-4 text-left transition hover:scale-[1.02]"
              style={{ backgroundColor: DARK_CARD }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{tour.name}</h3>
                  <p className="mt-1 text-xs opacity-50">{tour.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>
                      {tour.duration}
                    </span>
                    {tour.inclusions.slice(0, 3).map((inc) => (
                      <span key={inc} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] opacity-60">
                        {inc}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold" style={{ color: GOLD }}>
                    {"\u20B1"}{tour.price.toLocaleString()}
                  </p>
                  <p className="text-[10px] opacity-40">per person</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Booking Form */}
      {selectedTour && (
        <div className="space-y-4 rounded-2xl p-5 shadow-lg" style={{ backgroundColor: DARK_CARD }}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{selectedTour.name}</h2>
            <button
              onClick={() => setSelectedTour(null)}
              className="text-xs underline opacity-50"
            >
              Change
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide opacity-50">
              Tour Date
            </label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
              style={{
                backgroundColor: "#0f3460",
                borderColor: `${GOLD}44`,
                color: "#e8e8e8",
              }}
            />
          </div>

          {/* Pax */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide opacity-50">
              Number of Guests
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPax(Math.max(1, pax - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition"
                style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
              >
                -
              </button>
              <span className="w-12 text-center text-xl font-semibold">{pax}</span>
              <button
                onClick={() => setPax(Math.min(selectedTour.capacity, pax + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition"
                style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[10px] opacity-40">
              Max {selectedTour.capacity} guests per departure
            </p>
          </div>

          {/* Price Summary */}
          <div className="border-t pt-4" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">
                {selectedTour.name} x {pax}
              </span>
              <span>{"\u20B1"}{selectedTour.price.toLocaleString()} x {pax}</span>
            </div>
            <div className="mt-2 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span style={{ color: GOLD }}>{"\u20B1"}{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Guest Info */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "#0f346022" }}>
            <p className="text-xs opacity-50">Booking for</p>
            <p className="text-sm font-medium">{guest.name}</p>
            <p className="text-xs opacity-50">{guest.phone}</p>
          </div>

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            className="w-full rounded-lg py-3 text-sm font-medium transition"
            style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
          >
            Confirm Booking
          </button>
        </div>
      )}
    </div>
  );
}
