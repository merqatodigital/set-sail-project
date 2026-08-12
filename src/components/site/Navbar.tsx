import { useEffect, useState } from "react";
import { Menu, Sparkles, X, ChevronDown, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCms } from "@/context/CmsContext";
import { useCurrency } from "@/context/CurrencyContext";
import { openTalaIntent } from "@/components/tala/talaOpen";
import { cn } from "@/utils/cn";

const LINKS = [
  { label: "Workspace", href: "#workspace" },
  { label: "Kitchen", href: "#kitchen" },
  { label: "Stay", href: "#accommodation" },
  { label: "Pricing", href: "#pricing" },
  { label: "Field Notes", href: "/blog" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { data } = useCms();
  const currencyState = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !isHome;

  const handleNav = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) {
      if (isHome) {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate("/" + href);
      }
    } else {
      navigate(href);
    }
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        solid ? "bg-[#FAF6EF]/95 shadow-sm shadow-black/5 backdrop-blur-md" : "bg-gradient-to-b from-black/40 to-transparent"
      )}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-6 lg:px-12 lg:py-5">
        <Link
          to="/"
          className={cn(
            "font-serif text-base font-medium tracking-[0.18em] transition-colors sm:text-xl",
            solid ? "text-[#26221C]" : "text-white"
          )}
        >
          {data.settings.logoText}
        </Link>

        <nav className="hidden items-center gap-9 lg:flex" aria-label="Main navigation">
          {LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNav(link.href)}
              className={cn(
                "text-[13px] font-medium uppercase tracking-[0.12em] transition-colors",
                solid ? "text-[#26221C]/70 hover:text-[#26221C]" : "text-white/85 hover:text-white"
              )}
            >
              {link.label}
            </button>
          ))}
          {/* Elegant Currency Selector Dropdown */}
          <div className="relative inline-flex items-center">
            <select
              value={currencyState.currency}
              onChange={(e) => currencyState.setCurrency(e.target.value as any)}
              aria-label="Select currency"
              className={cn(
                "appearance-none h-9 rounded-full pl-4 pr-8 text-[12px] font-medium tracking-wide outline-none cursor-pointer transition-all duration-200",
                solid
                  ? "border border-[#26221C]/15 bg-white text-[#26221C] hover:border-[#26221C]/30"
                  : "border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:border-white/50"
              )}
            >
              <option value="PHP" className="text-black">PHP (₱)</option>
              <option value="USD" className="text-black">USD ($)</option>
              <option value="EUR" className="text-black">EUR (€)</option>
            </select>
            <ChevronDown className={cn(
              "pointer-events-none absolute right-3 h-3.5 w-3.5",
              solid ? "text-[#26221C]/60" : "text-white/60"
            )} />
          </div>

          {data.settings.whatsapp.showInNavbar && (
            <button
              type="button"
              onClick={() =>
                openTalaIntent(
                  "general_help",
                  { source: "header", interest: "general" },
                  "Hi TALA! I'd like to ask about staying or booking.",
                )
              }
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-medium tracking-wide transition-all duration-200 active:scale-[0.97]",
                solid
                  ? "bg-[#26221C] text-[#F5EFE2] hover:bg-[#3a3327] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                  : "border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/20"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Talk to TALA</span>
            </button>
          )}
          <Link
            to="/portal"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-medium tracking-wide transition-all duration-200 active:scale-[0.97]",
              solid
                ? "border border-[#C6A15B]/40 bg-[#C6A15B]/10 text-[#C6A15B] hover:bg-[#C6A15B]/20"
                : "border border-[#C6A15B]/40 bg-[#C6A15B]/10 text-[#C6A15B] backdrop-blur-sm hover:bg-[#C6A15B]/20"
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>Guest Portal</span>
          </Link>
        </nav>

        <button
          onClick={() => setOpen(!open)}
          className={cn("lg:hidden", solid ? "text-[#26221C]" : "text-white")}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-[#FAF6EF] lg:hidden"
          >
            <div className="flex flex-col gap-0.5 px-5 pb-5 sm:px-6">
              {LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNav(link.href)}
                  className="py-2.5 text-left text-[13px] font-medium uppercase tracking-wide text-[#26221C]/80 border-b border-[#26221C]/5 sm:py-3 sm:text-sm"
                >
                  {link.label}
                </button>
              ))}
              {/* Mobile Currency Selector */}
              <div className="relative mt-2 flex items-center sm:mt-3">
                <select
                  value={currencyState.currency}
                  onChange={(e) => currencyState.setCurrency(e.target.value as any)}
                  aria-label="Select currency"
                  className="w-full h-10 rounded-full border border-[#26221C]/15 bg-white pl-4 pr-10 text-[13px] font-medium text-[#26221C] outline-none appearance-none sm:h-11 sm:text-sm"
                >
                  <option value="PHP">Philippine Peso (₱)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-[#26221C]/60" />
              </div>

              <button
                type="button"
                onClick={() =>
                  openTalaIntent(
                    "general_help",
                    { source: "header_mobile", interest: "general" },
                    "Hi TALA! I'd like to ask about staying or booking.",
                  )
                }
                className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#26221C] px-5 text-[13px] font-medium text-[#F5EFE2] shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition active:scale-[0.98] sm:mt-4 sm:h-11 sm:text-sm"
              >
                <Sparkles className="h-4 w-4" /> Talk to TALA
              </button>
              <Link
                to="/portal"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#C6A15B]/40 bg-[#C6A15B]/10 px-5 text-[13px] font-medium text-[#C6A15B] transition active:scale-[0.98] sm:mt-3 sm:h-11 sm:text-sm"
              >
                <User className="h-4 w-4" /> Guest Portal
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
