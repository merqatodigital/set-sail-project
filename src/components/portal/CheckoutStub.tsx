import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Checkout stub — shows the guest their balance and the payment methods we
// plan to support, WITHOUT faking a payment. Online settlement is coming soon;
// the front desk records the real payment (admin). No success state is ever
// shown until a real payment exists in the folio.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";
const GREEN = "#1F3D2B";

interface Props {
  balance: number;
  totalCharges: number;
  totalPaid: number;
}

type Method = { id: string; label: string; note: string; comingSoon: boolean };

const METHODS: Method[] = [
  { id: "gcash", label: "GCash", note: "QR payment at reception", comingSoon: true },
  { id: "stripe", label: "Card (Stripe)", note: "Online card checkout", comingSoon: true },
  { id: "bitcoin", label: "Bitcoin", note: "On-chain checkout", comingSoon: true },
];

export default function CheckoutStub({ balance }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  const settleNow = useMemo(() => balance > 0, [balance]);
  const fmt = (n: number) => `₱${n.toLocaleString()}`;

  return (
    <div className="rounded-xl p-4 shadow-lg sm:rounded-2xl sm:p-5" style={{ backgroundColor: DARK_CARD }}>
      <h2 className="mb-1 text-sm uppercase tracking-wide opacity-50">Checkout</h2>
      <p className="mb-3 text-xs opacity-40">
        Online payment is coming soon. Select a method below to see how you'll pay.
      </p>

      <div className="space-y-2">
        {METHODS.map((m) => {
          const active = picked === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setPicked(active ? null : m.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition hover:bg-white/5"
              style={{ borderColor: active ? GOLD : `${GOLD}33` }}
              aria-pressed={active}
            >
              <span className="text-sm font-medium">{m.label}</span>
              <span className="text-[11px] opacity-40">{m.note}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-3 rounded-lg p-3 text-xs" style={{ backgroundColor: `${GOLD}11` }}>
          {settleNow ? (
            <p>
              <span className="font-semibold" style={{ color: GOLD }}>{"\u{1F6A7}"} Coming soon.</span>{" "}
              Your outstanding balance is <span className="font-semibold">{fmt(balance)}</span>. Please
              settle with our team at the front desk, or we'll be in touch on WhatsApp once online payment
              is live.
            </p>
          ) : (
            <p>
              <span className="font-semibold" style={{ color: GREEN }}>{"\u2705"} All settled.</span>{" "}
              No outstanding balance on your folio.
            </p>
          )}
        </div>
      )}

      {settleNow && (
        <p className="mt-3 text-[10px] opacity-30">
          Balances shown are informational — the confirmed payment is recorded by the team.
        </p>
      )}
    </div>
  );
}