import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Loader2, Mail, Sparkles, User, Phone } from "lucide-react";
import type { CmsData } from "@/types/cms";
import { useCurrency } from "@/context/CurrencyContext";
import { normalizePhone } from "@/lib/portalRepo";
import { todayISO, addDays } from "./talaDate";
import { requestDayPass } from "./useTalaChat";

const GREEN = "#1F3D2B";
const GREEN_DARK = "#16301F";
const GOLD = "#C6A15B";
const CREAM = "#FAF6EF";
const INK = "#26221C";

/**
 * Workspace Day Pass structured form.
 *
 * The guest picks a day, adds the contact details the worker requires, and the
 * confirm action POSTs through the SAME Cloudflare TallaAgent that powers TALA
 * chat (requestRoomBooking → one pending tala_booking_requests row, MT- ref).
 * Pricing shown is authoritative from cms_data.pricing (Day Pass entry) — we
 * never send a price to the worker and never fake a payment.
 */
export function DayPassForm({ cms }: { cms: CmsData }) {
  const { formatPrice } = useCurrency();
  const priceMeta = useMemo(() => {
    const row = [...(cms.pricing ?? [])]
      .sort((a, b) => a.order - b.order)
      .find((p) => /day ?pass/i.test(p.name));
    return row ? { label: row.name, price: row.price } : null;
  }, [cms]);

  const [day, setDay] = useState(todayISO());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const canSubmit = !busy && !!name.trim() && !!email.trim() && !!phone.trim() && !!day;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestDayPass({
        guestName: name.trim(),
        guestEmail: email.trim(),
        guestPhone: normalizePhone(phone),
        day,
      });
      if (mounted.current) setDone({ reference: res.reference });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Could not reach TALA.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div
      className="mx-1 rounded-xl border-2 px-3.5 py-3"
      style={{ borderColor: GOLD, backgroundColor: "#FFFFFF", color: INK }}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
        <Sparkles className="h-3.5 w-3.5" /> Workspace Day Pass
      </p>

      {done ? (
        <div className="py-1">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Request saved.</span>{" "}
            {done.reference ? (
              <>Reference <span className="font-mono font-semibold">{done.reference}</span> — the team will confirm shortly.</>
            ) : (
              "The team will confirm shortly."
            )}
          </p>
          <p className="mt-1.5 text-xs opacity-60">
            No payment taken now. You'll settle once the day pass is confirmed.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-sm opacity-70">
              {priceMeta ? priceMeta.label : "Day Pass"}
              <span className="ml-1 text-xs opacity-50">/ day</span>
            </span>
            <span className="font-serif text-xl">
              {priceMeta ? String(priceMeta.price) : ""}
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 opacity-70">
                <Calendar className="h-3.5 w-3.5" /> Day
              </span>
              <input
                type="date"
                min={todayISO()}
                value={day}
                onChange={(e) => setDay(e.target.value || todayISO())}
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ borderColor: `${GOLD}55` }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 opacity-70">
                <User className="h-3.5 w-3.5" /> Full name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ borderColor: `${GOLD}55` }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 opacity-70">
                <Mail className="h-3.5 w-3.5" /> Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ borderColor: `${GOLD}55` }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 opacity-70">
                <Phone className="h-3.5 w-3.5" /> WhatsApp / mobile
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ borderColor: `${GOLD}55` }}
              />
            </label>
          </div>

          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <p className="mt-2 text-[11px] opacity-60">
            No payment taken now — this saves a request and the team confirms before you settle.
          </p>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: GREEN }}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking TALA…
              </>
            ) : (
              "Request Day Pass"
            )}
          </button>
        </>
      )}
    </div>
  );
}