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
  const packages = [...data.pricing].sort((a, b) => a.order - b.order);

  return (
    <section id="pricing" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">Pricing &amp; Packages</p>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-[#26221C] sm:text-5xl">Choose the Pace That Fits Your Work</h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {packages.map((pkg, i) => {
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
                  "relative flex flex-col rounded-3xl border p-8 transition-shadow duration-300",
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
                    "mb-6 flex h-12 w-12 items-center justify-center rounded-full",
                    pkg.featured ? "bg-white/10" : "bg-[#C6A15B]/12"
                  )}
                >
                  <Icon className={cn("h-5 w-5", pkg.featured ? "text-[#D9BA80]" : "text-[#C6A15B]")} strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-xl">{pkg.name}</h3>
                <p className={cn("mt-2 text-sm leading-relaxed", pkg.featured ? "text-[#F5EFE2]/65" : "text-[#26221C]/60")}>
                  {pkg.description}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-serif text-4xl">{formatPrice(pkg.price)}</span>
                  <span className={cn("text-sm", pkg.featured ? "text-[#F5EFE2]/50" : "text-[#26221C]/45")}>{pkg.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
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
                    "mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-medium tracking-wide transition-all duration-200 active:scale-[0.98] sm:h-12 sm:px-6 sm:text-sm",
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
      </div>
    </section>
  );
}
