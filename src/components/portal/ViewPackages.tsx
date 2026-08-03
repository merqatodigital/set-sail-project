import { useCms } from "@/context/CmsContext";
import { openTala } from "@/components/tala/talaOpen";
import type { PackageItem } from "@/types/cms";

// ---------------------------------------------------------------------------
// View Packages — shows available all-inclusive packages for the guest.
// Always displays in Philippine Pesos (PHP).
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

const fmt = (n: number) => `₱${n.toLocaleString()}`;

interface Props {
  onBack: () => void;
}

export default function ViewPackages({ onBack }: Props) {
  const { data } = useCms();
  const packages = [...data.packages].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <span>{"\u2190"}</span> Back
      </button>

      <div>
        <h1 className="text-xl font-semibold">All-Inclusive Packages</h1>
        <p className="mt-1 text-sm opacity-50">Everything you need, one price. Just bring yourself.</p>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: DARK_CARD }}>
          <p className="opacity-50">No packages available right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg }: { pkg: PackageItem }) {
  return (
    <div
      className="rounded-2xl p-5 shadow-lg"
      style={{
        backgroundColor: DARK_CARD,
        border: pkg.featured ? `1px solid ${GOLD}44` : "1px solid transparent",
      }}
    >
      {pkg.featured && (
        <span
          className="mb-3 inline-block rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
        >
          Most Popular
        </span>
      )}

      <h2 className="text-lg font-semibold">{pkg.name}</h2>
      <p className="mt-1 text-sm opacity-50">{pkg.description}</p>

      {/* Pricing Box */}
      <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "#0f346022" }}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm opacity-60">1 Person</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={{ color: GOLD }}>{fmt(pkg.price)}</span>
              <span className="text-xs opacity-40">/ {pkg.period}</span>
            </div>
          </div>
          {pkg.priceTwo > 0 && (
            <div className="flex items-center justify-between border-t" style={{ borderColor: `${GOLD}22` }}>
              <span className="text-sm opacity-60">2 People</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: GOLD }}>{fmt(pkg.priceTwo)}</span>
                <span className="text-xs opacity-40">/ {pkg.period}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* What's Included Table */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-50">What's Included</p>
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#0f346011" }}>
          <table className="w-full text-sm">
            <tbody>
              {pkg.features.map((f, i) => (
                <tr key={f.id} style={{ borderBottom: i < pkg.features.length - 1 ? `1px solid ${GOLD}11` : "none" }}>
                  <td className="px-3 py-2.5">
                    <span style={{ color: GOLD }}>{"\u2713"}</span>
                  </td>
                  <td className="px-3 py-2.5 opacity-70">{f.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => openTala(`Hi TALA! I'd like to book the ${pkg.name} package.`)}
        className="mt-5 w-full rounded-lg py-3 text-sm font-medium transition"
        style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
      >
        {pkg.buttonLabel}
      </button>
    </div>
  );
}
