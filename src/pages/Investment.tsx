import { useState, useRef, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Globe,
  Landmark,
  Sparkles,
  Users,
  UtensilsCrossed,
  Waves,
  Wallet,
  TrendingUp,
  MapPin,
  Check,
  Loader2,
  Send,
  Star,
  Calendar,
  Shield,
  BarChart3,
  PieChart,
  Target,
  Mail,
  Phone,
  User,
  MessageSquare,
  Building2,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/utils/cn";
import {
  AMUMA_MEANING,
  AMUMA_EXECUTIVE_SUMMARY,
  AMUMA_MEMBERSHIP,
  AMUMA_PEBBLES,
  AMUMA_HIDDEN_DESTINATIONS,
  AMUMA_TIERS,
  AMUMA_TIERS_NOTE,
  AMUMA_REVENUE,
  AMUMA_RETURNS,
  AMUMA_FLYWHEEL,
  AMUMA_FLYWHEEL_NOTE,
  AMUMA_PILLARS,
  AMUMA_SAN_VICENTE,
  AMUMA_ROADMAP,
  AMUMA_ROADMAP_NOTE,
  AMUMA_TEAM,
  AMUMA_PORTAL,
  AMUMA_FINANCIALS,
  AMUMA_FOUNDING_CIRCLE,
  AMUMA_RISKS,
  AMUMA_LEGAL,
  AMUMA_CONTACT,
  AMUMA_CLOSING,
  AMUMA_HEARD_OPTIONS,
} from "@/lib/amumaData";
import { submitAmumaApplication, type AmumaApplicationInput } from "@/lib/amumaApplications";

// ---------------------------------------------------------------------------
// Navigation items for the sticky sidebar
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { id: "hero", label: "Overview" },
  { id: "membership", label: "Membership" },
  { id: "pebbles", label: "Pebbles" },
  { id: "destinations", label: "Destinations" },
  { id: "tiers", label: "Investment Tiers" },
  { id: "returns", label: "Returns" },
  { id: "flywheel", label: "Flywheel" },
  { id: "pillars", label: "Experience" },
  { id: "san-vicente", label: "San Vicente" },
  { id: "roadmap", label: "Roadmap" },
  { id: "team", label: "Team" },
  { id: "portal", label: "Member Portal" },
  { id: "financials", label: "Financials" },
  { id: "founding", label: "Founding Circle" },
  { id: "risks", label: "Risks" },
  { id: "apply", label: "Apply" },
];

// ---------------------------------------------------------------------------
// Reusable small components
// ---------------------------------------------------------------------------
function SectionBadge({ label }: { label: string }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C6A15B] sm:text-xs">
      {label}
    </p>
  );
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "font-serif text-3xl font-light leading-[1.1] text-[#26221C] sm:text-4xl lg:text-5xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function DataTable({
  head,
  rows,
  highlightLast,
}: {
  head: string[];
  rows: string[][];
  highlightLast?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#26221C]/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#26221C]/10 bg-[#26221C]/5">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/60">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                "border-b border-[#26221C]/5 last:border-0",
                highlightLast && ri === rows.length - 1 && "bg-[#C6A15B]/8 font-medium",
              )}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3 text-[#26221C]/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------
function SideNav({ active }: { active: string }) {
  return (
    <nav className="sticky top-28 hidden w-48 shrink-0 lg:block">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "block rounded-lg px-3 py-1.5 text-[12px] font-medium tracking-wide transition-colors",
                active === item.id
                  ? "bg-[#C6A15B]/15 text-[#C6A15B]"
                  : "text-[#26221C]/45 hover:text-[#26221C]/70 hover:bg-[#26221C]/5",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Application Form
// ---------------------------------------------------------------------------
function ApplicationForm() {
  const [form, setForm] = useState<AmumaApplicationInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    heardFrom: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await submitAmumaApplication(form);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-[#C6A15B]/30 bg-[#C6A15B]/10 p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C6A15B]/20">
          <Check className="h-7 w-7 text-[#C6A15B]" />
        </div>
        <h3 className="font-serif text-2xl text-[#26221C]">Application Received</h3>
        <p className="mt-2 text-sm text-[#26221C]/60">
          Thank you for your interest in the AMUMA Circle. Our founding team will review your
          application and reach out within 48 hours.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
            First Name *
          </label>
          <input
            required
            type="text"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
            Last Name *
          </label>
          <input
            required
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
            Email *
          </label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
            Phone
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
            Country of Residence
          </label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
            How did you hear about AMUMA?
          </label>
          <select
            value={form.heardFrom}
            onChange={(e) => setForm({ ...form, heardFrom: e.target.value })}
            className="w-full appearance-none rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          >
            <option value="">Select...</option>
            {AMUMA_HEARD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#26221C]/50">
          Message (optional)
        </label>
        <textarea
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full resize-none rounded-xl border border-[#26221C]/15 bg-white px-4 py-3 text-sm text-[#26221C] outline-none transition-colors focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
          placeholder="Tell us about your interest in the AMUMA Circle..."
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-[#C6A15B] px-8 text-[13px] font-medium tracking-wide text-[#221D14] shadow-[0_4px_14px_rgba(198,161,91,0.35)] transition-all duration-200 hover:bg-[#D9BA80] hover:shadow-[0_6px_20px_rgba(198,161,91,0.5)] active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span>{submitting ? "Submitting..." : "Submit Application"}</span>
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Flywheel Step
// ---------------------------------------------------------------------------
function FlywheelStep({
  step,
  index,
  total,
}: {
  step: { title: string; body: string };
  index: number;
  total: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="relative flex gap-5"
    >
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B] text-[13px] font-semibold text-[#221D14]">
          {index + 1}
        </div>
        {index < total - 1 && <div className="mt-2 w-px flex-1 bg-[#C6A15B]/30" />}
      </div>
      <div className="pb-8">
        <h4 className="font-serif text-lg text-[#26221C]">{step.title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-[#26221C]/60">{step.body}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Investment Page
// ---------------------------------------------------------------------------
export default function Investment() {
  const [activeSection, setActiveSection] = useState("hero");
  const [financialTab, setFinancialTab] = useState<"assumptions" | "income" | "cashflow" | "useOfFunds">("assumptions");
  const reducedMotion = useReducedMotion();

  // Intersection observer for active sidebar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );

    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ------------------------------------------------------------------ */}
      {/* Hero */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="hero"
        className="relative overflow-hidden bg-[#1B1812] py-24 sm:py-32 lg:py-40"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "radial-gradient(circle at 70% 30%, #C6A15B 0%, transparent 60%)" }}
        />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
          <Reveal>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#C6A15B]/80">
              AMUMA Circle
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="max-w-4xl font-serif text-4xl font-light leading-[1.08] text-white sm:text-5xl lg:text-7xl">
              {AMUMA_MEANING.split("meaning").map((part, i) =>
                i === 0 ? (
                  <span key={i}>
                    {part} <span className="text-[#C6A15B]">meaning</span>
                  </span>
                ) : (
                  <span key={i} className="text-white/70">
                    {part}
                  </span>
                ),
              )}
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/50 sm:text-lg">
              A membership-based boutique resort collection inviting you to become a co-creator of
              destinations — not just a guest. Earn projected annual returns of 17–20% while
              nurturing the hidden gems of Southeast Asia.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <a
                href="#apply"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#C6A15B] px-7 text-[13px] font-medium tracking-wide text-[#221D14] shadow-[0_4px_14px_rgba(198,161,91,0.4)] transition-all duration-200 hover:bg-[#D9BA80] hover:shadow-[0_6px_20px_rgba(198,161,91,0.55)] active:scale-[0.98]"
              >
                <span>Apply for Founding Circle</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#membership"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 text-[13px] font-medium tracking-wide text-white/80 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-white/10 active:scale-[0.98]"
              >
                <span>Explore the Model</span>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Main content with sidebar */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        <div className="flex gap-12 py-12 lg:py-16">
          <SideNav active={activeSection} />

          <div className="min-w-0 flex-1 space-y-20">
            {/* ------------------------------------------------------------ */}
            {/* Executive Summary */}
            {/* ------------------------------------------------------------ */}
            <section id="summary">
              <Reveal>
                <SectionBadge label="Executive Summary" />
                <SectionHeading>The Future of Member-Owned Travel</SectionHeading>
              </Reveal>
              <div className="mt-6 space-y-4">
                {AMUMA_EXECUTIVE_SUMMARY.map((para, i) => (
                  <Reveal key={i} delay={i * 0.05}>
                    <p className="text-sm leading-relaxed text-[#26221C]/70 sm:text-base">{para}</p>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Membership Model */}
            {/* ------------------------------------------------------------ */}
            <section id="membership">
              <Reveal>
                <SectionBadge label="The Circle" />
                <SectionHeading>Membership Model</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_MEMBERSHIP.intro}
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="mt-3 text-sm leading-relaxed text-[#26221C]/60">
                  {AMUMA_MEMBERSHIP.flywheelNote}
                </p>
              </Reveal>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-[#26221C]/10 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#C6A15B]/15">
                    <Users className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <h4 className="font-serif text-lg text-[#26221C]">Co-Creation Rights</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#26221C]/60">
                    {AMUMA_MEMBERSHIP.coCreation}
                  </p>
                </motion.div>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-[#26221C]/10 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#C6A15B]/15">
                    <CircleDollarSign className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
                  </div>
                  <h4 className="font-serif text-lg text-[#26221C]">Revenue Participation</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#26221C]/60">
                    {AMUMA_MEMBERSHIP.revenue}
                  </p>
                </motion.div>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Pebbles Currency */}
            {/* ------------------------------------------------------------ */}
            <section id="pebbles">
              <Reveal>
                <SectionBadge label="Lifestyle Currency" />
                <SectionHeading>Pebbles</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_PEBBLES.intro}
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="mt-3 text-sm leading-relaxed text-[#26221C]/60">
                  {AMUMA_PEBBLES.cycle}
                </p>
              </Reveal>
              <Reveal delay={0.2} className="mt-6">
                <DataTable head={AMUMA_PEBBLES.rates.head} rows={AMUMA_PEBBLES.rates.rows} />
              </Reveal>
              <Reveal delay={0.25}>
                <p className="mt-4 text-sm italic text-[#26221C]/50">
                  {AMUMA_PEBBLES.generosity}
                </p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Hidden Destinations */}
            {/* ------------------------------------------------------------ */}
            <section id="destinations">
              <Reveal>
                <SectionBadge label="Strategy" />
                <SectionHeading>Hidden Destinations</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_HIDDEN_DESTINATIONS.intro}
                </p>
              </Reveal>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {AMUMA_HIDDEN_DESTINATIONS.advantages.map((adv, i) => (
                  <Reveal key={i} delay={0.15 + i * 0.05}>
                    <div className="flex items-start gap-3 rounded-xl border border-[#C6A15B]/20 bg-[#C6A15B]/5 p-4">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
                      <span className="text-sm text-[#26221C]/70">{adv}</span>
                    </div>
                  </Reveal>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Reveal delay={0.2}>
                  <div className="rounded-2xl border border-[#26221C]/10 bg-white p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#C6A15B]" />
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-[#26221C]/60">
                        Philippines Pipeline
                      </h4>
                    </div>
                    <ul className="space-y-2">
                      {AMUMA_HIDDEN_DESTINATIONS.philippines.map((loc, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#26221C]/70">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C6A15B]" />
                          {loc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
                <Reveal delay={0.25}>
                  <div className="rounded-2xl border border-[#26221C]/10 bg-white p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4 text-[#C6A15B]" />
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-[#26221C]/60">
                        Southeast Asia Pipeline
                      </h4>
                    </div>
                    <ul className="space-y-2">
                      {AMUMA_HIDDEN_DESTINATIONS.southeastAsia.map((loc, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#26221C]/70">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C6A15B]" />
                          {loc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>
              <Reveal delay={0.3}>
                <p className="mt-4 text-sm text-[#26221C]/60">{AMUMA_HIDDEN_DESTINATIONS.screening}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Investment Tiers */}
            {/* ------------------------------------------------------------ */}
            <section id="tiers">
              <Reveal>
                <SectionBadge label="Investment" />
                <SectionHeading>Investment Tiers</SectionHeading>
              </Reveal>
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {AMUMA_TIERS.map((tier, i) => (
                  <motion.div
                    key={tier.name}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    whileHover={{ y: -8, transition: { duration: 0.25 } }}
                    className={cn(
                      "relative flex flex-col rounded-2xl border p-6 transition-shadow duration-300",
                      i === 0
                        ? "border-[#C6A15B] bg-[#26221C] text-[#F5EFE2] shadow-xl shadow-[#C6A15B]/20"
                        : "border-[#26221C]/10 bg-white text-[#26221C] hover:shadow-lg hover:shadow-black/5",
                    )}
                  >
                    {i === 0 && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C6A15B] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#221D14]">
                        Founding Circle
                      </span>
                    )}
                    <h3 className="font-serif text-xl">{tier.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-serif text-3xl">{tier.investment}</span>
                    </div>
                    <div className="mt-4 space-y-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className={cn("h-4 w-4 shrink-0", i === 0 ? "text-[#D9BA80]" : "text-[#C6A15B]")} />
                        <span className={i === 0 ? "text-[#F5EFE2]/80" : "text-[#26221C]/70"}>
                          {tier.units}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className={cn("h-4 w-4 shrink-0", i === 0 ? "text-[#D9BA80]" : "text-[#C6A15B]")} />
                        <span className={i === 0 ? "text-[#F5EFE2]/80" : "text-[#26221C]/70"}>
                          {tier.pebbles} Pebbles/year
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "mt-auto pt-4 text-xs font-medium",
                      i === 0 ? "text-[#D9BA80]" : "text-[#C6A15B]",
                    )}>
                      {tier.availability}
                    </div>
                  </motion.div>
                ))}
              </div>
              <Reveal delay={0.2}>
                <p className="mt-6 text-sm text-[#26221C]/60">{AMUMA_TIERS_NOTE}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Revenue & Returns */}
            {/* ------------------------------------------------------------ */}
            <section id="returns">
              <Reveal>
                <SectionBadge label="Financials" />
                <SectionHeading>Revenue & Projected Returns</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_REVENUE.intro}
                </p>
              </Reveal>
              <Reveal delay={0.15} className="mt-6">
                <DataTable head={AMUMA_REVENUE.rates.head} rows={AMUMA_REVENUE.rates.rows} />
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mt-4 text-sm text-[#26221C]/60">{AMUMA_REVENUE.split}</p>
              </Reveal>
              <Reveal delay={0.25}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_RETURNS.intro}
                </p>
              </Reveal>
              <Reveal delay={0.3} className="mt-6">
                <div className="rounded-2xl border border-[#C6A15B]/30 bg-[#C6A15B]/8 p-6">
                  <h4 className="mb-4 font-serif text-lg text-[#26221C]">Nova Tier Investor Example</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {AMUMA_RETURNS.novaExample.map(([label, value], i) => (
                      <div key={i} className="flex items-baseline justify-between rounded-lg bg-white/60 px-4 py-2.5">
                        <span className="text-xs text-[#26221C]/50">{label}</span>
                        <span className="text-sm font-medium text-[#26221C]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Flywheel */}
            {/* ------------------------------------------------------------ */}
            <section id="flywheel">
              <Reveal>
                <SectionBadge label="Growth Engine" />
                <SectionHeading>The AMUMA Flywheel</SectionHeading>
              </Reveal>
              <div className="mt-8">
                {AMUMA_FLYWHEEL.map((step, i) => (
                  <FlywheelStep key={i} step={step} index={i} total={AMUMA_FLYWHEEL.length} />
                ))}
              </div>
              <Reveal>
                <p className="text-sm italic text-[#26221C]/50">{AMUMA_FLYWHEEL_NOTE}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Experience Pillars */}
            {/* ------------------------------------------------------------ */}
            <section id="pillars">
              <Reveal>
                <SectionBadge label="Philosophy" />
                <SectionHeading>Experience Pillars</SectionHeading>
              </Reveal>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {AMUMA_PILLARS.map((pillar, i) => {
                  const iconMap: Record<string, any> = {
                    Sparkles,
                    Waves,
                    Compass,
                    UtensilsCrossed,
                    Users,
                  };
                  const Icon = iconMap[pillar.icon] || Sparkles;
                  return (
                    <motion.div
                      key={pillar.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                      whileHover={{ y: -4 }}
                      className="rounded-2xl border border-[#26221C]/10 bg-white p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
                    >
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#C6A15B]/15">
                        <Icon className="h-5 w-5 text-[#C6A15B]" strokeWidth={1.5} />
                      </div>
                      <h4 className="font-serif text-lg text-[#26221C]">{pillar.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-[#26221C]/60">{pillar.body}</p>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* San Vicente */}
            {/* ------------------------------------------------------------ */}
            <section id="san-vicente">
              <Reveal>
                <SectionBadge label="First Chapter" />
                <SectionHeading>San Vicente, Palawan</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_SAN_VICENTE.intro}
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="mt-3 text-sm text-[#26221C]/60">{AMUMA_SAN_VICENTE.architecture}</p>
              </Reveal>
              <Reveal delay={0.2} className="mt-6">
                <DataTable
                  head={AMUMA_SAN_VICENTE.allocation.head}
                  rows={AMUMA_SAN_VICENTE.allocation.rows}
                  highlightLast
                />
              </Reveal>
              <Reveal delay={0.25}>
                <p className="mt-4 text-sm text-[#26221C]/60">{AMUMA_SAN_VICENTE.proofOfWork}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Roadmap */}
            {/* ------------------------------------------------------------ */}
            <section id="roadmap">
              <Reveal>
                <SectionBadge label="Timeline" />
                <SectionHeading>Roadmap 2026–2035</SectionHeading>
              </Reveal>
              <div className="mt-8 space-y-0">
                {AMUMA_ROADMAP.map(([year, milestone], i) => (
                  <motion.div
                    key={year}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="relative flex gap-5"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#C6A15B] bg-white font-serif text-sm font-medium text-[#C6A15B]">
                        {year}
                      </div>
                      {i < AMUMA_ROADMAP.length - 1 && (
                        <div className="mt-2 w-px flex-1 bg-[#C6A15B]/25" />
                      )}
                    </div>
                    <div className="pb-8 pt-2">
                      <p className="text-sm leading-relaxed text-[#26221C]/70">{milestone}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Reveal>
                <p className="text-sm italic text-[#26221C]/50">{AMUMA_ROADMAP_NOTE}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Team */}
            {/* ------------------------------------------------------------ */}
            <section id="team">
              <Reveal>
                <SectionBadge label="Leadership" />
                <SectionHeading>Founding Team</SectionHeading>
              </Reveal>
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
                {AMUMA_TEAM.map((member, i) => (
                  <motion.div
                    key={member.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="rounded-2xl border border-[#26221C]/10 bg-white p-6"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#26221C]">
                      <span className="font-serif text-lg text-[#C6A15B]">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </span>
                    </div>
                    <h4 className="font-serif text-lg text-[#26221C]">{member.name}</h4>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-[#C6A15B]">
                      {member.role}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-[#26221C]/60">{member.body}</p>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Member Portal */}
            {/* ------------------------------------------------------------ */}
            <section id="portal">
              <Reveal>
                <SectionBadge label="Digital Hub" />
                <SectionHeading>Member Portal</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_PORTAL.intro}
                </p>
              </Reveal>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {AMUMA_PORTAL.features.map(([title, desc], i) => (
                  <Reveal key={i} delay={0.15 + i * 0.04}>
                    <div className="flex items-start gap-3 rounded-xl bg-white p-4 border border-[#26221C]/5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
                      <div>
                        <p className="text-sm font-medium text-[#26221C]">{title}</p>
                        <p className="mt-0.5 text-xs text-[#26221C]/55">{desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.4}>
                <p className="mt-4 text-sm text-[#26221C]/60">{AMUMA_PORTAL.closing}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Financials (Tabbed) */}
            {/* ------------------------------------------------------------ */}
            <section id="financials">
              <Reveal>
                <SectionBadge label="Projections" />
                <SectionHeading>Financial Plan</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_FINANCIALS.intro}
                </p>
              </Reveal>

              {/* Tab navigation */}
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap gap-2 border-b border-[#26221C]/10 pb-px">
                  {([
                    ["assumptions", "Assumptions", Target],
                    ["income", "Income Statement", BarChart3],
                    ["cashflow", "Cash Flow", Wallet],
                    ["useOfFunds", "Use of Funds", PieChart],
                  ] as const).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setFinancialTab(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-[12px] font-medium tracking-wide transition-colors",
                        financialTab === key
                          ? "border-b-2 border-[#C6A15B] bg-[#C6A15B]/10 text-[#C6A15B]"
                          : "text-[#26221C]/45 hover:text-[#26221C]/70",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </Reveal>

              <AnimatePresence mode="wait">
                <motion.div
                  key={financialTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6"
                >
                  {financialTab === "assumptions" && (
                    <DataTable
                      head={AMUMA_FINANCIALS.assumptions.head}
                      rows={AMUMA_FINANCIALS.assumptions.rows}
                    />
                  )}
                  {financialTab === "income" && (
                    <DataTable
                      head={AMUMA_FINANCIALS.income.head}
                      rows={AMUMA_FINANCIALS.income.rows}
                      highlightLast
                    />
                  )}
                  {financialTab === "cashflow" && (
                    <DataTable
                      head={AMUMA_FINANCIALS.cashflow.head}
                      rows={AMUMA_FINANCIALS.cashflow.rows}
                      highlightLast
                    />
                  )}
                  {financialTab === "useOfFunds" && (
                    <DataTable
                      head={AMUMA_FINANCIALS.useOfFunds.head}
                      rows={AMUMA_FINANCIALS.useOfFunds.rows}
                      highlightLast
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <Reveal delay={0.2}>
                <p className="mt-4 text-sm text-[#26221C]/60">{AMUMA_FINANCIALS.structure}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Founding Circle */}
            {/* ------------------------------------------------------------ */}
            <section id="founding">
              <Reveal>
                <SectionBadge label="Limited Offer" />
                <SectionHeading>The Founding Circle</SectionHeading>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-4 text-sm leading-relaxed text-[#26221C]/70 sm:text-base">
                  {AMUMA_FOUNDING_CIRCLE.intro}
                </p>
              </Reveal>
              <div className="mt-6 rounded-2xl border border-[#C6A15B]/30 bg-[#C6A15B]/8 p-6">
                <h4 className="mb-4 font-serif text-lg text-[#26221C]">Founding Circle Benefits</h4>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {AMUMA_FOUNDING_CIRCLE.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-[#26221C]/70">
                      <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C6A15B]" />
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>
              <Reveal delay={0.2}>
                <p className="mt-4 text-sm text-[#26221C]/60">{AMUMA_FOUNDING_CIRCLE.process}</p>
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Risks */}
            {/* ------------------------------------------------------------ */}
            <section id="risks">
              <Reveal>
                <SectionBadge label="Due Diligence" />
                <SectionHeading>Risk Factors</SectionHeading>
              </Reveal>
              <Reveal delay={0.1} className="mt-6">
                <DataTable head={AMUMA_RISKS.head} rows={AMUMA_RISKS.rows} />
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Legal */}
            {/* ------------------------------------------------------------ */}
            <section id="legal">
              <Reveal>
                <SectionBadge label="Legal" />
                <SectionHeading>Legal & Governance</SectionHeading>
              </Reveal>
              <div className="mt-6 space-y-4">
                <Reveal delay={0.05}>
                  <div>
                    <h4 className="text-sm font-medium text-[#26221C]">Securities Restrictions</h4>
                    <p className="mt-1 text-sm text-[#26221C]/60">{AMUMA_LEGAL.securities}</p>
                  </div>
                </Reveal>
                <Reveal delay={0.1}>
                  <div>
                    <h4 className="text-sm font-medium text-[#26221C]">Forward-Looking Statements</h4>
                    <p className="mt-1 text-sm text-[#26221C]/60">{AMUMA_LEGAL.forwardLooking}</p>
                  </div>
                </Reveal>
                <Reveal delay={0.15}>
                  <div>
                    <h4 className="text-sm font-medium text-[#26221C]">Intellectual Property</h4>
                    <p className="mt-1 text-sm text-[#26221C]/60">{AMUMA_LEGAL.ip}</p>
                  </div>
                </Reveal>
                <Reveal delay={0.2}>
                  <div>
                    <h4 className="text-sm font-medium text-[#26221C]">Governing Law</h4>
                    <p className="mt-1 text-sm text-[#26221C]/60">{AMUMA_LEGAL.governance}</p>
                  </div>
                </Reveal>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Application Form */}
            {/* ------------------------------------------------------------ */}
            <section id="apply">
              <Reveal>
                <SectionBadge label="Join the Circle" />
                <SectionHeading>Apply for the Founding Circle</SectionHeading>
                <p className="mt-3 max-w-xl text-sm text-[#26221C]/60">
                  {AMUMA_CLOSING}
                </p>
              </Reveal>
              <Reveal delay={0.1} className="mt-8">
                <ApplicationForm />
              </Reveal>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Contact */}
            {/* ------------------------------------------------------------ */}
            <section className="border-t border-[#26221C]/10 pt-10">
              <div className="flex flex-col gap-4 text-sm text-[#26221C]/50 sm:flex-row sm:items-center sm:gap-6">
                <a
                  href={`mailto:${AMUMA_CONTACT.email}`}
                  className="inline-flex items-center gap-2 hover:text-[#C6A15B]"
                >
                  <Mail className="h-4 w-4" /> {AMUMA_CONTACT.email}
                </a>
                <a
                  href={`tel:${AMUMA_CONTACT.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 hover:text-[#C6A15B]"
                >
                  <Phone className="h-4 w-4" /> {AMUMA_CONTACT.phone}
                </a>
              </div>
              <p className="mt-4 text-xs text-[#26221C]/35">
                © {new Date().getFullYear()} AMUMA Collection. All rights reserved.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
