import { useCms } from "@/context/CmsContext";
import { useCurrency } from "@/context/CurrencyContext";
import { openTala } from "@/components/tala/talaOpen";
import type { PackageItem } from "@/types/cms";

// ---------------------------------------------------------------------------
// View Packages — shows available all-inclusive packages for the guest.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  onBack: () => void;
}

export default function ViewPackages({ onBack }: Props) {
  const { data } = useCms();
  const { formatPrice } = useCurrency();
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
            <PackageCard key={pkg.id} pkg={pkg} formatPrice={formatPrice} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, formatPrice }: { pkg: PackageItem; formatPrice: (n: number) => string }) {
  return (
    <div
      className="rounded-2xl p-5 shadow-lg"
      style={{
        backgroundColor: pkg.featured ? "#16213e" : "#1a1a2e",
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

      {/* Pricing */}
      <div className="mt-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm opacity-60">1 Person</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold" style={{ color: GOLD }}>{formatPrice(pkg.price)}</span>
            <span className="text-xs opacity-40">/ {pkg.period}</span>
          </div>
        </div>
        {pkg.priceTwo > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm opacity-60">2 People</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold" style={{ color: GOLD }}>{formatPrice(pkg.priceTwo)}</span>
              <span className="text-xs opacity-40">/ {pkg.period}</span>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mt-4 space-y-2">
        {pkg.features.map((f) => (
          <li key={f.id} className="flex items-start gap-2 text-sm">
            <span style={{ color: GOLD }}>{"\u2713"}</span>
            <span className="opacity-70">{f.text}</span>
          </li>
        ))}
      </ul>

      {/* Inclusions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {pkg.includeMotorbike && (
          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>
            Motorbike Included
          </span>
        )}
        {pkg.includeAirportTransfer && (
          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>
            Airport Transfer
          </span>
        )}
        {pkg.dailyCoffeeCount > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>
            {pkg.dailyCoffeeCount}x Daily Coffee
          </span>
        )}
        {pkg.dailyMealCount > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${GOLD}22`, color: GOLD }}>
            {pkg.dailyMealCount}x Daily Meal
          </span>
        )}
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
