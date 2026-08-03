import { MapPin, Phone, Mail, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useCms } from "@/context/CmsContext";
import { safeHref, safeMailto, safeTel } from "@/lib/security";
import { openTala } from "@/components/tala/talaOpen";
import { Reveal } from "./Reveal";
import { InstagramIcon, FacebookIcon, YoutubeIcon } from "./SocialIcons";

export function CtaSection() {
  const { data } = useCms();
  const home = data.homepage;

  return (
    <section className="relative overflow-hidden bg-[#1B1812] py-24 lg:py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle at 30% 20%, #C6A15B 0%, transparent 55%)" }}
      />
      <div className="relative mx-auto flex max-w-[1400px] flex-col items-center gap-8 px-6 text-center lg:px-12">
        <Reveal>
          <h2 className="font-serif text-4xl font-light leading-[1.1] text-white sm:text-6xl">{home.ctaTitle}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="max-w-xl text-base leading-relaxed text-white/60">{home.ctaSubtext}</p>
        </Reveal>
        <Reveal delay={0.2}>
          <button
            type="button"
            onClick={() => openTala("Hi TALA! I'd like to check availability and book a stay.")}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#C6A15B] px-6 text-[13px] font-medium tracking-wide text-[#221D14] shadow-[0_6px_20px_rgba(198,161,91,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:bg-[#D9BA80] hover:shadow-[0_10px_28px_rgba(198,161,91,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.98] sm:h-14 sm:px-8 sm:text-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>{home.ctaButtonLabel}</span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  const { data } = useCms();
  const c = data.settings.contact;

  const socials = [
    { href: c.social.instagram, Icon: InstagramIcon, label: "Instagram" },
    { href: c.social.facebook, Icon: FacebookIcon, label: "Facebook" },
    { href: c.social.youtube, Icon: YoutubeIcon, label: "YouTube" },
  ];

  return (
    <footer className="bg-[#141210] text-white/70">
      {/* pb-24 on mobile gives enough clearance so the fixed WhatsApp button
          (bottom-4, h-12 ≈ 64px total) never overlaps the footer bottom row. */}
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-14 sm:px-8 sm:pb-16 sm:pt-16 lg:px-12 lg:pb-20 lg:pt-20">
        {/*
          Layout strategy:
          - mobile (base): brand on top, then Explore + Contact side-by-side (2 cols)
            to keep the footer compact instead of stretched vertically, then a
            full-width Booking block at the bottom.
          - tablet (sm): same 2-col rhythm — brand spans 2, Explore/Contact each
            take one column, Booking spans 2 for a balanced grid.
          - desktop (lg): 4 uniform columns, all top-aligned.
        */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-4 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <p className="font-serif text-lg font-medium tracking-[0.18em] text-white sm:text-xl">
              {data.settings.logoText}
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/50">
              {data.settings.tagline}
            </p>
            <div className="mt-5 flex gap-2.5">
              {socials.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={safeHref(href, "#")}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 transition-colors hover:border-[#C6A15B] hover:text-[#C6A15B]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div className="min-w-0">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Explore</p>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#workspace" className="hover:text-[#C6A15B]">Workspace</a></li>
              <li><a href="#kitchen" className="hover:text-[#C6A15B]">Kitchen</a></li>
              <li><a href="#accommodation" className="hover:text-[#C6A15B]">Stay</a></li>
              <li><a href="#pricing" className="hover:text-[#C6A15B]">Pricing</a></li>
              <li><Link to="/blog" className="hover:text-[#C6A15B]">Blog</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="min-w-0">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Contact</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
                <span className="min-w-0 break-words leading-relaxed">{c.address}</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
                <a href={safeTel(c.phone)} className="min-w-0 break-words hover:text-[#C6A15B]">
                  {c.phone}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
                <a href={safeMailto(c.email)} className="min-w-0 truncate hover:text-[#C6A15B]" title={c.email}>
                  {c.email}
                </a>
              </li>
            </ul>
          </div>

          {/* Booking */}
          <div className="col-span-2 lg:col-span-1">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Booking</p>
            <p className="mb-4 text-sm leading-relaxed text-white/50">{c.businessHours}</p>
            <button
              type="button"
              onClick={() => openTala("Hi TALA! I'd like to book or ask about availability.")}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 text-[12px] font-medium tracking-wide text-[#221D14] shadow-[0_2px_10px_rgba(198,161,91,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:bg-[#D9BA80] active:scale-[0.98] sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              <span>Book with TALA</span>
            </button>
          </div>
        </div>

        {/* Bottom bar
            Admin link is placed on the LEFT (mobile: above copyright) so it
            is never hidden behind the fixed WhatsApp button that lives
            at bottom-right. On desktop the two items sit on opposite ends. */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-xs text-white/35 sm:mt-14 sm:flex-row sm:justify-between sm:gap-4 sm:pt-8">
          <Link
            to="/admin"
            className="order-first flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/5 hover:text-white/70 sm:order-none"
            title="Open admin dashboard"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin
          </Link>
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} {data.settings.siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFloat() {
  const { data } = useCms();
  if (!data.settings.whatsapp.showFloatingButton) return null;
  return (
    <button
      type="button"
      onClick={() => openTala("Hi TALA! How can you help me today?")}
      aria-label="Chat with TALA"
      className="group fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition-all duration-200 hover:scale-110 hover:shadow-[0_10px_28px_rgba(37,211,102,0.55)] active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/40 opacity-0 transition-opacity duration-500 group-hover:animate-ping group-hover:opacity-75" />
      <Sparkles className="relative h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );
}
