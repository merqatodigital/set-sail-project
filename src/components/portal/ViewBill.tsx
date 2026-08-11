import { useMemo } from "react";
import type { Booking, TourBooking, MotorbikeRental, FoodOrder, Payment } from "@/types/cms";
import { useCms } from "@/context/CmsContext";
import CheckoutStub from "./CheckoutStub";

// ---------------------------------------------------------------------------
// View Bill — aggregated charges and payments for the guest.
// Reconstructed from backend records ONLY (bookings / tour / rental / food
// orders / folio lines), plus the site's configured Day Pass price and folio
// fee — so the total always mirrors what the Day Pass form quotes.
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
  record: { guestName: string; guestPhone?: string; notes?: string },
  guest: { phone: string; name: string },
): boolean {
  // Day Pass requests carry guest_phone as a real column (worker path), so
  // compare it directly first; blob demo rows store it in notes.
  const colPhoneMatch =
    !!record.guestPhone && record.guestPhone.replace(/\s/g, "") === guest.phone.replace(/\s/g, "");
  const phoneFromNotes = record.notes?.match(/Phone:\s*(.+)/i)?.[1]?.replace(/\s/g, "") || "";
  const notesPhoneMatch = !!phoneFromNotes && phoneFromNotes === guest.phone.replace(/\s/g, "");
  const nameMatch = record.guestName.toLowerCase() === guest.name.toLowerCase();
  return colPhoneMatch || notesPhoneMatch || nameMatch;
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

  // Day Pass rows are a distinct product line in the folio — shown on their
  // own line, with the amount derived from the configured Day Pass price
  // whenever the backend row doesn't carry an amount (the worker writes
  // amount=0; the authoritative rate lives in settings.financial.dayPassPrice).
  const dayPassBookings = useMemo(
    () => myBookings.filter((b) => /day ?pass/i.test(b.roomType)),
    [myBookings],
  );
  const otherBookings = useMemo(
    () => myBookings.filter((b) => !/day ?pass/i.test(b.roomType)),
    [myBookings],
  );

  const { data: cms } = useCms();
  const financial = cms?.settings?.financial;
  const dayPassPrice =
    typeof financial?.dayPassPrice === "number" && financial.dayPassPrice > 0
      ? financial.dayPassPrice
      : 1040;
  const serviceFeePercent = financial?.folioServiceFeePercent || 0;

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

  const dayPassCharge = useMemo(
    () =>
      dayPassBookings.reduce(
        (s, b) => s + (b.amount > 0 ? b.amount : dayPassPrice * Math.max(1, b.guests || 1)),
        0,
      ),
    [dayPassBookings, dayPassPrice],
  );
  const otherBookingsCharge = useMemo(
    () => otherBookings.reduce((s, b) => s + b.amount, 0),
    [otherBookings],
  );
  const toursCharge = useMemo(() => myTours.reduce((s, t) => s + t.amount, 0), [myTours]);
  const rentalsCharge = useMemo(() => myRentals.reduce((s, r) => s + r.amount, 0), [myRentals]);
  const foodCharge = useMemo(() => myFoodOrders.reduce((s, f) => s + f.total, 0), [myFoodOrders]);

  const subtotal = dayPassCharge + otherBookingsCharge + toursCharge + rentalsCharge + foodCharge;
  // Configured folio fee (percent of subtotal) — 0 until set in Admin.
  const serviceFee = Math.round(subtotal * serviceFeePercent) / 100;
  const totalCharges = subtotal + serviceFee;

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
            <span className="opacity-50">Day Pass</span>
            <span>{fmt(dayPassCharge)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Room Bookings</span>
            <span>{fmt(otherBookingsCharge)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Tours</span>
            <span>{fmt(toursCharge)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Motorbike Rentals</span>
            <span>{fmt(rentalsCharge)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Food & Drinks</span>
            <span>{fmt(foodCharge)}</span>
          </div>
          <div className="border-t pt-3" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-sm">
              <span className="opacity-50">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-50">
                Taxes & Fees{serviceFeePercent > 0 ? ` (${serviceFeePercent}%)` : ""}
              </span>
              <span className={serviceFee > 0 ? "" : "opacity-50"}>{fmt(serviceFee)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm font-semibold">
              <span>Total Charges</span>
              <span>{fmt(totalCharges)}</span>
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

      {/* Breakdown: Day Pass */}
      {dayPassBookings.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Day Pass</h2>
          <div className="space-y-2">
            {dayPassBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: DARK_CARD }}>
                <div>
                  <p className="text-sm font-medium">{b.roomType}</p>
                  <p className="text-xs opacity-40">{b.checkIn} · {Math.max(1, b.guests || 1)} pax</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: GOLD }}>
                  {fmt(b.amount > 0 ? b.amount : dayPassPrice * Math.max(1, b.guests || 1))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown: Room Bookings */}
      {otherBookings.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide opacity-50">Room Bookings</h2>
          <div className="space-y-2">
            {otherBookings.map((b) => (
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

      {/* Checkout */}
      <CheckoutStub balance={balance} totalCharges={totalCharges} totalPaid={totalPaid} />

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
