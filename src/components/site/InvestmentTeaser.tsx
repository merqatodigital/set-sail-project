import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";
import { AMUMA_TIERS } from "@/lib/amumaData";

export function InvestmentTeaser() {
  return (
    <section className="relative overflow-hidden bg-[#FAF6EF] py-16 sm:py-20 lg:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #C6A15B 0%, transparent 55%)" }}
      />
      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <Reveal>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C6A15B] sm:text-xs">
                AMUMA Circle
              </p>
              <h2 className="font-serif text-3xl font-light leading-[1.1] text-[#26221C] sm:text-4xl">
                Own a Piece of the <span className="text-[#C6A15B]">Hidden Destinations</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#26221C]/60 sm:text-base">
                Join the AMUMA Circle — a membership-based boutique resort collection offering
                17–20% projected annual returns through co-ownership of exclusive hidden
                destinations across Southeast Asia.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link
                  to="/investment"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#26221C] px-6 text-[13px] font-medium tracking-wide text-[#F5EFE2] shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-200 hover:bg-[#3a3327] active:scale-[0.98]"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Explore Investment</span>
                </Link>
                <Link
                  to="/investment#apply"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[#C6A15B]/40 bg-[#C6A15B]/10 px-6 text-[13px] font-medium tracking-wide text-[#C6A15B] transition-all duration-200 hover:bg-[#C6A15B]/20 active:scale-[0.98]"
                >
                  <span>Apply for Founding Circle</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Tier cards */}
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col lg:gap-3">
            {AMUMA_TIERS.slice(0, 2).map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4 rounded-xl border border-[#26221C]/10 bg-white px-5 py-4 shadow-sm sm:flex-1 lg: flex-1"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/15 font-serif text-sm font-medium text-[#C6A15B]">
                  {tier.name[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-[#26221C]/50">{tier.name}</p>
                  <p className="font-serif text-lg text-[#26221C]">{tier.investment}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
