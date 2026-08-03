import type { PortalBookingResult } from "@/pages/Portal";

// ---------------------------------------------------------------------------
// GCash QR — displays QR code after booking confirmation.
// Image hosted in Supabase Storage: images-payment/gcash (public bucket).
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const GCASH_QR_URL = `${SUPABASE_URL}/storage/v1/object/public/images-payment/gcash`;

interface Props {
  booking: PortalBookingResult;
  onDone: () => void;
}

export default function GCashQR({ booking, onDone }: Props) {
  return (
    <div className="flex flex-col items-center space-y-6 py-6">
      {/* Success Message */}
      <div className="text-center">
        <div className="mb-4 text-4xl">{"\u2705"}</div>
        <h1 className="text-xl font-semibold">Booking Confirmed!</h1>
        <p className="mt-2 text-sm opacity-60">
          {booking.type === "tour" ? "Tour" : "Rental"} booked successfully
        </p>
      </div>

      {/* Booking Summary */}
      <div className="w-full rounded-2xl p-5 shadow-lg" style={{ backgroundColor: DARK_CARD }}>
        <div className="space-y-3">
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
              <span>Total</span>
              <span style={{ color: GOLD }}>{"\u20B1"}{booking.amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GCash QR */}
      <div className="w-full rounded-2xl p-5 shadow-lg" style={{ backgroundColor: DARK_CARD }}>
        <p className="mb-4 text-center text-sm font-medium">Pay with GCash</p>

        <div className="flex justify-center">
          <div className="overflow-hidden rounded-xl bg-white p-2">
            <img
              src={GCASH_QR_URL}
              alt="GCash QR Code"
              className="h-64 w-64 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const fallback = document.createElement("div");
                  fallback.className = "flex h-64 w-64 items-center justify-center bg-gray-100 text-gray-500 text-sm text-center p-4";
                  fallback.innerHTML = `
                    <div>
                      <p class="font-bold text-gray-700 mb-2">GCash QR Code</p>
                      <p class="text-xs text-gray-500">QU****E O.</p>
                      <p class="text-xs text-gray-500">0917 894 ****</p>
                    </div>
                  `;
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2 text-center">
          <p className="text-xs opacity-50">
            Scan the QR code to pay {"\u20B1"}{booking.amount.toLocaleString()}
          </p>
          <p className="text-[10px] opacity-30">
            Transfer fees may apply
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="w-full rounded-xl p-4" style={{ backgroundColor: `${GOLD}11` }}>
        <p className="text-xs font-medium" style={{ color: GOLD }}>How to pay:</p>
        <ol className="mt-2 space-y-1 text-xs opacity-60">
          <li>1. Open your GCash app</li>
          <li>2. Tap "Scan" and scan the QR code above</li>
          <li>3. Enter the amount: {"\u20B1"}{booking.amount.toLocaleString()}</li>
          <li>4. Confirm the payment</li>
          <li>5. Show your receipt to our staff</li>
        </ol>
      </div>

      {/* Done */}
      <button
        onClick={onDone}
        className="w-full rounded-lg py-3 text-sm font-medium transition"
        style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
      >
        Done
      </button>
    </div>
  );
}
