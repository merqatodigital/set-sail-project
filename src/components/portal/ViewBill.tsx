import { useMemo } from "react";
import type { Booking, TourBooking, MotorbikeRental, FoodOrder, Payment } from "@/types/cms";

// ---------------------------------------------------------------------------
// View Bill — aggregated charges and payments for the guest.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  guest: { phone: string; name: string };
  bookings: Booking[];
  tourBookings: TourBooking[];
  rentals: MotorbikeRental[];
  foodOrders: FoodOrder[];
  payments: Payment[];
  onBack: () => void;
}

function matchGuest(
  record: { guestName: string; guestPhone?: string },
  guest: { phone: string; name: string },
): boolean {
  const phoneMatch = record.guestPhone?.replace(/\s/g, "") === guest.phone.replace(/\s/g, "");
  const nameMatch = record.guestName.toLowerCase() === guest.name.toLowerCase();
  return phoneMatch || nameMatch;
}

function matchBooking(
  record: { guestName: string; notes?: string },
  guest: { phone: string; name: string },
): boolean {
  const phoneFromNotes = record.notes?.match(/Phone:\s*(.+)/i)?.[1]?.replace(/\s/g, "") || "";
  const phoneMatch = phoneFromNotes === guest.phone.replace(/\s/g, "");
  const nameMatch = record.guestName.toLowerCase() === guest.name.toLowerCase();
  return phoneMatch || nameMatch;
}

export default function ViewBill({
  guest,
  bookings,
  tourBookings,
  rentals,
  foodOrders,
  payments,
  onBack,
}: Props) {
  const myBookings = useMemo(
    () => bookings.filter((b) => matchBooking(b, guest)),
    [bookings, guest],
  );

  const myTours = useMemo(
    () => tourBookings.filter((b) => matchGuest(b, guest)),
    [tourBookings, guest],
  );

  const myRentals = useMemo(
    () => rentals.filter((b) => matchGuest(b, guest)),
    [rentals, guest],
  );

  const myFoodOrders = useMemo(
    () => foodOrders.filter((o) => matchGuest(o, guest)),
    [foodOrders, guest],
  );

  const myPayments = useMemo(() => {
    const relatedIds = new Set([
      ...myBookings.map((b) => b.id),
      ...myTours.map((t) => t.id),
      ...myRentals.map((r) => r.id),
      ...myFoodOrders.map((f) => f.id),
    ]);
    return payments.filter(
      (p) => relatedIds.has(p.relatedId) || (p.description.includes(guest.name) && p.direction === "in"),
    );
  }, [payments, myBookings, myTours, myRentals, myFoodOrders, guest]);

  const totalCharges =
    myBookings.reduce((s, b) => s + b.amount, 0) +
    myTours.reduce((s, t) => s + t.amount, 0) +
    myRentals.reduce((s, r) => s + r.amount, 0) +
    myFoodOrders.reduce((s, f) => s + f.total, 0);

  const totalPaid = myPayments
    .filter((p) => p.direction === "in")
    .reduce((s, p) => s + p.amount, 0);

  const balance = totalCharges - totalPaid;

  const fmt = (n: number) => `₱${n.toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <span>{"\u2190"}</span> Back
      </button>

      <h1 className="text-xl font-semibold">My Bill</h1>

      {/* Summary */}
      <div className="rounded-xl p-4 shadow-lg sm:rounded-2xl sm:p-5" style={{ backgroundColor: DARK_CARD }}>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Room Bookings</span>
            <span>{fmt(myBookings.reduce((s, b) => s + b.amount, 0))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Tours</span>
            <span>{fmt(myTours.reduce((s, t) => s + t.amount, 0))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Motorbike Rentals</span>
            <span>{fmt(myRentals.reduce((s, r) => s + r.amount, 0))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Food & Drinks</span>
            <span>{fmt(myFoodOrders.reduce((s, f) => s + f.total, 0))}</span>
          </div>
          <div className="border-t pt-3" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-sm">
              <span className="opacity-50">Total Charges</span>
              <span className="font-semibold">{fmt(totalCharges)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Total Paid</span>
            <span className="font-semibold" style={{ color: "#4ade80" }}>-{fmt(totalPaid)}</span>
          </div>
          <div className="border-t pt-3" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-lg font-semibold">
              <span>Balance Due</span>
              <span style={{ color: balance > 0 ? "#fbbf24" : "#4ade80" }}>{fmt(balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown: Room Bookings */}
      {myBookings.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Room Bookings</h2>
          <div className="space-y-2">
            {myBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: DARK_CARD }}>
                <div>
                  <p className="text-sm font-medium">{b.roomType}</p>
                  <p className="text-xs opacity-40">{b.checkIn} → {b.checkOut}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: GOLD }}>{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown: Tours */}
      {myTours.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Tours</h2>
          <div className="space-y-2">
            {myTours.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: DARK_CARD }}>
                <div>
                  <p className="text-sm font-medium">{t.tourName}</p>
                  <p className="text-xs opacity-40">{t.date} · {t.guests} pax</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: GOLD }}>{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown: Rentals */}
      {myRentals.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Motorbike Rentals</h2>
          <div className="space-y-2">
            {myRentals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: DARK_CARD }}>
                <div>
                  <p className="text-sm font-medium">{r.bikeName}</p>
                  <p className="text-xs opacity-40">{r.startDate} → {r.endDate} · {r.days} day{r.days > 1 ? "s" : ""}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: GOLD }}>{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown: Food Orders */}
      {myFoodOrders.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Food & Drinks</h2>
          <div className="space-y-2">
            {myFoodOrders.map((f) => (
              <div key={f.id} className="rounded-xl p-4" style={{ backgroundColor: DARK_CARD }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{f.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}</p>
                    <p className="text-xs opacity-40">{new Date(f.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: GOLD }}>{fmt(f.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown: Payments */}
      {myPayments.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Payments</h2>
          <div className="space-y-2">
            {myPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: DARK_CARD }}>
                <div>
                  <p className="text-sm font-medium">{p.description || p.reference}</p>
                  <p className="text-xs opacity-40">{p.method.replace("_", " ")} · {p.date}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: p.direction === "in" ? "#4ade80" : "#f87171" }}>
                  {p.direction === "in" ? "+" : "-"}{fmt(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalCharges === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: DARK_CARD }}>
          <p className="text-4xl">{"\u{1F4B0}"}</p>
          <p className="mt-3 opacity-50">No charges yet.</p>
          <p className="mt-1 text-xs opacity-30">Book a tour, rent a bike, or order food to see your bill here.</p>
        </div>
      )}
    </div>
  );
}
