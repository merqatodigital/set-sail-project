import { useState } from "react";
import { useCms } from "@/context/CmsContext";

// ---------------------------------------------------------------------------
// Portal login — guest enters phone number, system finds their bookings.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  onLogin: (phone: string, name: string) => void;
}

export default function PortalLogin({ onLogin }: Props) {
  const { data } = useCms();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    const cleaned = phone.replace(/\s/g, "").replace(/^0/, "+63");
    if (!cleaned || cleaned.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    setError("");

    // Search all bookings for matching phone
    const allBookings = [
      ...data.operations.bookings.map((b) => ({
        name: b.guestName,
        phone: b.notes?.match(/Phone:\s*(.+)/i)?.[1] || "",
      })),
      ...data.operations.tourBookings.map((b) => ({
        name: b.guestName,
        phone: b.guestPhone || "",
      })),
      ...data.operations.motorbikeRentals.map((b) => ({
        name: b.guestName,
        phone: b.guestPhone || "",
      })),
    ];

    // Normalize for comparison
    const normalize = (p: string) => p.replace(/[\s\-+()]/g, "").replace(/^0/, "63");
    const searchPhone = normalize(cleaned);

    const match = allBookings.find((b) => {
      if (!b.phone) return false;
      return normalize(b.phone) === searchPhone;
    });

    setLoading(false);

    if (match) {
      onLogin(cleaned, match.name);
    } else {
      // Allow login anyway with a prompt for name
      setError("no_match");
    }
  };

  const handleManualLogin = (name: string) => {
    if (name.trim()) {
      onLogin(phone, name.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Logo / Branding */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold" style={{ color: GOLD }}>
          Guest Portal
        </h1>
        <p className="text-sm opacity-60">
          Sign in with your phone number to manage your stay
        </p>
      </div>

      {/* Login Card */}
      <div
        className="w-full rounded-2xl p-6 shadow-lg"
        style={{ backgroundColor: DARK_CARD }}
      >
        <label className="mb-2 block text-xs uppercase tracking-wide opacity-50">
          Phone Number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setError("");
          }}
          placeholder="0917 123 4567"
          className="mb-4 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "#0f3460",
            borderColor: `${GOLD}44`,
            color: "#e8e8e8",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {error && error !== "no_match" && (
          <p className="mb-4 text-xs text-red-400">{error}</p>
        )}

        {error === "no_match" && (
          <div className="mb-4">
            <p className="mb-3 text-xs text-amber-400">
              No booking found with this number. Enter your name to continue:
            </p>
            <input
              type="text"
              placeholder="Your name"
              className="mb-3 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
              style={{
                backgroundColor: "#0f3460",
                borderColor: `${GOLD}44`,
                color: "#e8e8e8",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualLogin(e.currentTarget.value);
              }}
              autoFocus
            />
            <button
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>(
                  'input[placeholder="Your name"]',
                );
                if (input) handleManualLogin(input.value);
              }}
              className="w-full rounded-lg py-3 text-sm font-medium transition"
              style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
            >
              Continue
            </button>
          </div>
        )}

        {!error && (
          <button
            onClick={handleSubmit}
            disabled={loading || !phone}
            className="w-full rounded-lg py-3 text-sm font-medium transition disabled:opacity-40"
            style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
          >
            {loading ? "Looking up..." : "Sign In"}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-xs opacity-40">
        Your phone number matches your booking records.
        <br />
        No password required.
      </p>
    </div>
  );
}
