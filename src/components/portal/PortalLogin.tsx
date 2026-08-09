import { useState } from "react";
import { useCms } from "@/context/CmsContext";
import { createPortalSession } from "@/lib/portalRepo";

// ---------------------------------------------------------------------------
// Portal login — guest enters phone + name. If phone matches a booking,
// name is auto-filled. The server issues a signed guest session (validated
// identity) so all private reads are scoped to this guest's phone number.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  onLogin: (phone: string, name: string) => void;
}

export default function PortalLogin({ onLogin }: Props) {
  const { data } = useCms();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const normalize = (p: string) => p.replace(/[\s\-+()]/g, "").replace(/^0/, "63");

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setError("");

    // Auto-fill name if phone matches a booking
    const cleaned = value.replace(/\s/g, "").replace(/^0/, "+63");
    const searchPhone = normalize(cleaned);

    if (searchPhone.length < 10) return;

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

    const match = allBookings.find((b) => {
      if (!b.phone) return false;
      return normalize(b.phone) === searchPhone;
    });

    if (match) {
      setName(match.name);
    }
  };

  const handleSubmit = async () => {
    const cleaned = phone.replace(/\s/g, "").replace(/^0/, "+63");
    const trimmedName = name.trim();

    if (!cleaned || cleaned.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }

    setError("");
    setStarting(true);

    // Start a validated server-side guest session. Private reads are only
    // available inside this signed session — no session, no portal.
    const token = await createPortalSession(cleaned, trimmedName);

    setStarting(false);

    if (!token) {
      setError("Could not start a secure session. Please try again or contact reception.");
      return;
    }

    onLogin(cleaned, trimmedName);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Logo / Branding */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold" style={{ color: GOLD }}>
          Guest Portal
        </h1>
        <p className="text-sm opacity-60">
          Enter your details to access the portal
        </p>
      </div>

      {/* Login Card */}
      <div
        className="w-full rounded-2xl p-6 shadow-lg"
        style={{ backgroundColor: DARK_CARD }}
      >
        {/* Privacy Notice */}
        <p className="mb-4 rounded-lg p-3 text-[11px] leading-relaxed opacity-50" style={{ backgroundColor: "#0f3460" }}>
          We collect your name and phone number to manage your booking and provide concierge services.
          Your data is stored securely and retained for 2 years after checkout. For details, see our{" "}
          <a href="/privacy" className="underline transition-colors hover:opacity-80">Privacy Policy</a>.
          You can request access, correction, or deletion of your data by contacting us.
        </p>
        <label className="mb-2 block text-xs uppercase tracking-wide opacity-50">
          Phone Number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="0917 123 4567"
          className="mb-4 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "#0f3460",
            borderColor: `${GOLD}44`,
            color: "#e8e8e8",
          }}
        />

        <label className="mb-2 block text-xs uppercase tracking-wide opacity-50">
          Your Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Juan Dela Cruz"
          className="mb-4 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "#0f3460",
            borderColor: `${GOLD}44`,
            color: "#e8e8e8",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {error && (
          <p className="mb-4 text-xs text-red-400">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!phone || !name || starting}
          className="w-full rounded-lg py-3 text-sm font-medium transition disabled:opacity-40"
          style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
        >
          {starting ? "Starting secure session…" : "Enter Portal"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs opacity-40">
        Your phone number links to your bookings and keeps your data private to you.
      </p>
    </div>
  );
}
