import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useCurrency } from "@/context/CurrencyContext";
import { getIcon } from "@/lib/icons";
import { openTala } from "@/components/tala/talaOpen";
import { Reveal } from "./Reveal";
import { cn } from "@/utils/cn";

export function PricingSection() {
  const { data } = useCms();
  const { formatPrice } = useCurrency();
  const pricing = [...data.pricing].sort((a, b) => a.order - b.order);
  const allInclusive = [...data.packages].sort((a, b) => a.order - b.order);

  return (
    <section id="pricing" className="bg-white py-16 sm:py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        {/* Section Header */}
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C6A15B] sm:text-xs">Pricing &amp; Packages</p>
          <h2 className="font-serif text-3xl font-light leading-[1.1] text-[#26221C] sm:text-4xl lg:text-5xl">Choose the Pace That Fits Your Work</h2>
        </Reveal>

        {/* Workspace Pricing */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:gap-8 md:grid-cols-3">
          {pricing.map((pkg, i) => {
            const Icon = getIcon(pkg.icon);
            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -8 }}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-shadow duration-300 sm:rounded-3xl sm:p-8",
                  pkg.featured
                    ? "border-[#C6A15B] bg-[#26221C] text-[#F5EFE2] shadow-xl shadow-[#C6A15B]/20"
                    : "border-[#26221C]/10 bg-[#FAF6EF] text-[#26221C] hover:shadow-lg hover:shadow-black/5"
                )}
              >
                {pkg.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C6A15B] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#221D14]">
                    Most Popular
                  </span>
                )}
                <div
                  className={cn(
                    "mb-5 flex h-11 w-11 items-center justify-center rounded-full sm:mb-6 sm:h-12 sm:w-12",
                    pkg.featured ? "bg-white/10" : "bg-[#C6A15B]/12"
                  )}
                >
                  <Icon className={cn("h-5 w-5", pkg.featured ? "text-[#D9BA80]" : "text-[#C6A15B]")} strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg sm:text-xl">{pkg.name}</h3>
                <p className={cn("mt-2 text-sm leading-relaxed", pkg.featured ? "text-[#F5EFE2]/65" : "text-[#26221C]/60")}>
                  {pkg.description}
                </p>
                <div className="mt-5 flex items-baseline gap-1 sm:mt-6">
                  <span className="font-serif text-3xl sm:text-4xl">{formatPrice(pkg.price)}</span>
                  <span className={cn("text-sm", pkg.featured ? "text-[#F5EFE2]/50" : "text-[#26221C]/45")}>{pkg.period}</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5 sm:mt-6 sm:space-y-3">
                  {pkg.features.map((line) => (
                    <li key={line.id} className="flex items-start gap-2.5 text-sm">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", pkg.featured ? "text-[#D9BA80]" : "text-[#C6A15B]")} />
                      <span className={pkg.featured ? "text-[#F5EFE2]/80" : "text-[#26221C]/70"}>{line.text}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => openTala(`Hi TALA! I'd like to book the ${pkg.name} package.`)}
                  className={cn(
                    "mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[13px] font-medium tracking-wide transition-all duration-200 active:scale-[0.98] sm:mt-8 sm:h-12 sm:px-6 sm:text-sm",
                    pkg.featured
                      ? "bg-[#C6A15B] text-[#221D14] shadow-[0_4px_14px_rgba(198,161,91,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-[#D9BA80] hover:shadow-[0_6px_20px_rgba(198,161,91,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]"
                      : "bg-[#26221C] text-[#F5EFE2] shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#3a3327]"
                  )}
                >
                  <span>{pkg.buttonLabel}</span>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* All-Inclusive Packages */}
        {allInclusive.length > 0 && (
          <>
            <Reveal className="mx-auto mt-16 max-w-xl text-center sm:mt-20">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C6A15B] sm:text-xs">All-Inclusive Packages</p>
              <h2 className="font-serif text-2xl font-light leading-[1.1] text-[#26221C] sm:text-3xl lg:text-4xl">Everything You Need, One Price</h2>
              <p className="mt-3 text-sm text-[#26221C]/60 sm:mt-4">Skip the planning. Accommodation, tours, meals, and transport — bundled.</p>
            </Reveal>

            {/* Mobile: stacked cards. Tablet/Desktop: 3-col grid */}
            <div className="mt-10 grid grid-cols-1 gap-6 sm:mt-12 sm:gap-8 md:grid-cols-3">
              {allInclusive.map((pkg, i) => {
                const Icon = getIcon(pkg.icon);
                return (
                  <motion.div
                    key={pkg.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -8 }}
                    className={cn(
                      "relative flex flex-col rounded-2xl border p-6 transition-shadow duration-300 sm:rounded-3xl sm:p-8",
                      pkg.featured
                        ? "border-[#C6A15B] bg-[#26221C] text-[#F5EFE2] shadow-xl shadow-[#C6A15B]/20"
                        : "border-[#26221C]/10 bg-[#FAF6EF] text-[#26221C] hover:shadow-lg hover:shadow-black/5"
                    )}
                  >
                    {pkg.featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C6A15B] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#221D14]">
                        Most Popular
                      </span>
                    )}

                    <div
                      className={cn(
                        "mb-5 flex h-11 w-11 items-center justify-center rounded-full sm:mb-6 sm:h-12 sm:w-12",
                        pkg.featured ? "bg-white/10" : "bg-[#C6A15B]/12"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", pkg.featured ? "text-[#D9BA80]" : "text-[#C6A15B]")} strokeWidth={1.5} />
                    </div>

                    <h3 className="font-serif text-lg sm:text-xl">{pkg.name}</h3>
                    <p className={cn("mt-2 text-sm leading-relaxed", pkg.featured ? "text-[#F5EFE2]/65" : "text-[#26221C]/60")}>
                      {pkg.description}
                    </p>

                    {/* Pricing Tiers */}
                    <div className={cn("mt-5 space-y-2.5 rounded-xl p-3.5 sm:mt-6 sm:rounded-2xl sm:p-4", pkg.featured ? "bg-white/5" : "bg-[#26221C]/5")}>
                      <div className="flex items-baseline justify-between">
                        <span className={cn("text-sm", pkg.featured ? "text-[#F5EFE2]/60" : "text-[#26221C]/50")}>1 Person</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-serif text-2xl sm:text-3xl">{formatPrice(pkg.price)}</span>
                          <span className={cn("text-[11px]", pkg.featured ? "text-[#F5EFE2]/40" : "text-[#26221C]/35")}>/ {pkg.period}</span>
                        </div>
                      </div>
                      {pkg.priceTwo > 0 && (
                        <div className="flex items-baseline justify-between border-t pt-2.5" style={{ borderColor: pkg.featured ? "rgba(255,255,255,0.08)" : "rgba(38,34,28,0.08)" }}>
                          <span className={cn("text-sm", pkg.featured ? "text-[#F5EFE2]/60" : "text-[#26221C]/50")}>2 People</span>
                          <div className="flex items-baseline gap-1">
                            <span className="font-serif text-2xl sm:text-3xl">{formatPrice(pkg.priceTwo)}</span>
                            <span className={cn("text-[11px]", pkg.featured ? "text-[#F5EFE2]/40" : "text-[#26221C]/35")}>/ {pkg.period}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="mt-5 flex-1 space-y-2.5 sm:mt-6 sm:space-y-3">
                      {pkg.features.map((line) => (
                        <li key={line.id} className="flex items-start gap-2.5 text-sm">
                          <Check className={cn("mt-0.5 h-4 w-4 shrink-0", pkg.featured ? "text-[#D9BA80]" : "text-[#C6A15B]")} />
                          <span className={pkg.featured ? "text-[#F5EFE2]/80" : "text-[#26221C]/70"}>{line.text}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => openTala(`Hi TALA! I'd like to book the ${pkg.name} package.`)}
                      className={cn(
                        "mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[13px] font-medium tracking-wide transition-all duration-200 active:scale-[0.98] sm:mt-8 sm:h-12 sm:px-6 sm:text-sm",
                        pkg.featured
                          ? "bg-[#C6A15B] text-[#221D14] shadow-[0_4px_14px_rgba(198,161,91,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-[#D9BA80] hover:shadow-[0_6px_20px_rgba(198,161,91,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]"
                          : "bg-[#26221C] text-[#F5EFE2] shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#3a3327]"
                      )}
                    >
                      <span>{pkg.buttonLabel}</span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
