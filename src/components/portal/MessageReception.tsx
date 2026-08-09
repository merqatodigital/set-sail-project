import { useState, useEffect, useCallback } from "react";
import { sendGuestMessage, fetchGuestMessages } from "@/lib/portalRepo";
import type { PortalGuestMessageRow } from "@/lib/portalRepo";

// ---------------------------------------------------------------------------
// Message Reception — guest sends a message to the front desk.
// Messages persist server-side (tala_guest_messages, source=portal) so they
// survive refresh/login and are visible to the TALA / admin inbox.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  guest: { phone: string; name: string };
  onBack: () => void;
}

function statusLabel(status: string): string {
  if (status === "replied") return "Replied";
  if (status === "read") return "Read";
  return "Sent";
}

function statusColor(status: string): string {
  if (status === "replied") return "#4ade80";
  if (status === "read") return "#60a5fa";
  return "#fbbf24";
}

export default function MessageReception({ guest, onBack }: Props) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [myMessages, setMyMessages] = useState<PortalGuestMessageRow[]>([]);

  const load = useCallback(async () => {
    const rows = await fetchGuestMessages({ name: guest.name, phone: guest.phone });
    setMyMessages(rows);
  }, [guest.name, guest.phone]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setError("");
    setSending(true);

    const saved = await sendGuestMessage({ name: guest.name, phone: guest.phone }, message);

    setSending(false);

    if (!saved) {
      setError("We couldn't send your message right now. Please try again.");
      return;
    }

    setSent(true);
    setMessage("");
    await load();
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <span>{"\u2190"}</span> Back
      </button>

      <h1 className="text-xl font-semibold">Message Reception</h1>

      {/* Send Message */}
      <div className="space-y-3 rounded-xl p-4 shadow-lg sm:rounded-2xl sm:p-5" style={{ backgroundColor: DARK_CARD }}>
        <p className="text-sm opacity-60">Send a message to our front desk team. We'll get back to you shortly.</p>
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSent(false);
          }}
          placeholder="Type your message here..."
          rows={3}
          className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
          style={{
            backgroundColor: "#0f3460",
            borderColor: `${GOLD}44`,
            color: "#e8e8e8",
          }}
        />
        {sent && (
          <p className="text-xs" style={{ color: "#4ade80" }}>
            Message sent! We'll respond soon.
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
        )}
        <button
          onClick={sendMessage}
          disabled={!message.trim() || sending}
          className="w-full rounded-lg py-3 text-sm font-medium transition disabled:opacity-40"
          style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
        >
          {sending ? "Sending…" : "Send Message"}
        </button>
      </div>

      {/* Message History */}
      {myMessages.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm uppercase tracking-wide opacity-50">Your Messages</h2>
          {myMessages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-xl p-4"
              style={{ backgroundColor: DARK_CARD }}
            >
              <p className="text-sm">{msg.message}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] opacity-30">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    backgroundColor: `${statusColor(msg.status)}22`,
                    color: statusColor(msg.status),
                  }}
                >
                  {statusLabel(msg.status)}
                </span>
              </div>
              {msg.reply && (
                <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "#0f346022" }}>
                  <p className="text-[10px] uppercase tracking-wide opacity-40">Reply from staff</p>
                  <p className="mt-1 text-sm">{msg.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
