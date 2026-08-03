import { useState, useMemo } from "react";
import { useCms } from "@/context/CmsContext";
import { uid } from "@/admin/ops/opsUtils";

// ---------------------------------------------------------------------------
// Message Reception — guest sends a message to the front desk.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  guest: { phone: string; name: string };
  onBack: () => void;
}

export default function MessageReception({ guest, onBack }: Props) {
  const { data, update } = useCms();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const myMessages = useMemo(
    () =>
      data.operations.guestMessages
        .filter(
          (m) =>
            m.guestPhone.replace(/\s/g, "") === guest.phone.replace(/\s/g, "") ||
            m.guestName.toLowerCase() === guest.name.toLowerCase(),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.operations.guestMessages, guest],
  );

  const sendMessage = () => {
    if (!message.trim()) return;

    const msg = {
      id: uid("msg"),
      guestName: guest.name,
      guestPhone: guest.phone,
      message: message.trim(),
      reply: "",
      status: "unread" as const,
      createdAt: new Date().toISOString(),
      repliedAt: "",
    };

    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        guestMessages: [...d.operations.guestMessages, msg],
      },
    }));

    setSent(true);
    setMessage("");
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
      <div className="space-y-3 rounded-2xl p-5 shadow-lg" style={{ backgroundColor: DARK_CARD }}>
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
        <button
          onClick={sendMessage}
          disabled={!message.trim()}
          className="w-full rounded-lg py-3 text-sm font-medium transition disabled:opacity-40"
          style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
        >
          Send Message
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
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    backgroundColor:
                      msg.status === "replied"
                        ? "#4ade8022"
                        : msg.status === "read"
                          ? "#60a5fa22"
                          : "#fbbf2422",
                    color:
                      msg.status === "replied"
                        ? "#4ade80"
                        : msg.status === "read"
                          ? "#60a5fa"
                          : "#fbbf24",
                  }}
                >
                  {msg.status === "replied" ? "Replied" : msg.status === "read" ? "Read" : "Sent"}
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
