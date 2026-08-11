import { useCms } from "@/context/CmsContext";
import { openTalaIntent } from "@/components/tala/talaOpen";
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
      className="rounded-xl p-4 shadow-lg sm:rounded-2xl sm:p-5"
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
      <div className="mt-3.5 sm:mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-50 sm:text-xs">What's Included</p>
        <div className="rounded-lg overflow-hidden sm:rounded-xl" style={{ backgroundColor: "#0f346011" }}>
          <table className="w-full text-sm">
            <tbody>
              {pkg.features.map((f, i) => (
                <tr key={f.id} style={{ borderBottom: i < pkg.features.length - 1 ? `1px solid ${GOLD}11` : "none" }}>
                  <td className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <span style={{ color: GOLD }}>{"\u2713"}</span>
                  </td>
                  <td className="px-2.5 py-2 opacity-70 sm:px-3 sm:py-2.5">{f.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => openTalaIntent("package_booking", { packageName: pkg.name }, `Hi TALA! I'd like to book the ${pkg.name} package.`)}
        className="mt-4 w-full rounded-lg py-2.5 text-sm font-medium transition sm:mt-5 sm:py-3"
        style={{ backgroundColor: GOLD, color: "#1a1a2e" }}
      >
        {pkg.buttonLabel}
      </button>
    </div>
  );
}
