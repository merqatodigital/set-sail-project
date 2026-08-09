import type { PortalBookingResult } from "@/pages/Portal";

// ---------------------------------------------------------------------------
// Request Received — shown immediately after a guest submits a tour/rental
// REQUEST. A REQUESTED intent is NOT confirmed and NOT paid; TALA / reception
// checks availability first. Payment UI only appears later, once the owner
// confirms the request. This view never implies success or payment.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  booking: PortalBookingResult;
  onViewBookings: () => void;
  onHome: () => void;
}

export default function RequestReceived({ booking, onViewBookings, onHome }: Props) {
  return (
    <div className="flex flex-col items-center space-y-6 py-6">
      {/* Received message */}
      <div className="text-center">
        <div className="mb-4 text-5xl">{"\u{1F4CB}"}</div>
        <h1 className="text-xl font-semibold">Request Received</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed opacity-60">
          TALA and our reception team are checking availability. We'll confirm
          your {booking.type === "tour" ? "tour" : "rental"} by message once
          it's arranged.
        </p>
      </div>

      {/* Request summary */}
      <div className="w-full rounded-2xl p-5 shadow-lg" style={{ backgroundColor: DARK_CARD }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ backgroundColor: "#fbbf2422", color: "#fbbf24" }}>
              PENDING CONFIRMATION
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Service</span>
            <span className="font-medium">{booking.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">Reference</span>
            <span className="font-mono text-xs">{booking.reference}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-50">{booking.type === "tour" ? "Date" : "Start Date"}</span>
            <span>{booking.date}</span>
          </div>
          {booking.pax && (
            <div className="flex justify-between text-sm">
              <span className="opacity-50">Guests</span>
              <span>{booking.pax} pax</span>
            </div>
          )}
          {booking.days && (
            <div className="flex justify-between text-sm">
              <span className="opacity-50">Duration</span>
              <span>{booking.days} day{booking.days > 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="border-t pt-3" style={{ borderColor: `${GOLD}22` }}>
            <div className="flex justify-between text-lg font-semibold">
              <span>Estimated Total</span>
              <span style={{ color: GOLD }}>{"\u20B1"}{booking.amount.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-right text-[10px] opacity-40">
              Payment instructions appear here once your request is confirmed.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-2.5">
        <button
          onClick={onViewBookings}
          className="w-full rounded-lg py-3 text-sm font-medium transition"
          style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
        >
          View My Bookings
        </button>
        <button
          onClick={onHome}
          className="w-full rounded-lg py-3 text-sm font-medium transition opacity-70 hover:opacity-100"
          style={{ border: `1px solid ${GOLD}44` }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
