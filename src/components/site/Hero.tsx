import { motion } from "framer-motion";
import { MapPin, MessageCircle, CalendarCheck } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { safeHref } from "@/lib/security";
import { getBackgroundEmbedUrl } from "@/lib/videoUtils";
import { openTalaIntent } from "@/components/tala/talaOpen";

export function Hero() {
  const { data } = useCms();
  const hero = data.homepage.hero;
  const media = data.media.find((m) => m.id === hero.imageId);
  const isVideo = media?.type === "video";

  const scrollTo = (href: string) => {
    if (href.startsWith("#")) document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    else window.open(safeHref(href, "/"), "_blank", "noopener,noreferrer");
  };

  return (
    <section
      id="home"
      className="relative flex w-full items-end overflow-hidden bg-[#1B1812]
                 min-h-[100svh] sm:min-h-[92vh] lg:min-h-[100vh]"
    >
      {/*
        Background layer — supports three media states:
          1. Image (default)   → object-cover keeps the ocean/horizon framed
             on every aspect ratio.
          2. Uploaded video    → silent autoplaying/looping <video>.
          3. YouTube/Vimeo url → background-style iframe embed, scaled up and
             cropped via overflow-hidden to emulate object-cover.
        Falls back to a warm gradient if nothing is set yet.
      */}
      <div className="absolute inset-0">
        {media?.url && isVideo && media.provider === "upload" ? (
          <video
            src={media.url}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover object-[center_60%]"
            aria-label={media.label || "Marina Terrace rooftop"}
          />
        ) : media?.url && isVideo ? (
          <iframe
            src={getBackgroundEmbedUrl(media.provider || "youtube", media.url)}
            title={media.label || "Marina Terrace rooftop"}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2"
            style={{ border: 0 }}
            allow="autoplay; encrypted-media"
            loading="eager"
          />
        ) : media?.url ? (
          <img
            src={media.url}
            alt={media.label || "Marina Terrace rooftop"}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover object-[center_60%]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#3B342B] via-[#26221C] to-[#1B1812]" />
        )}

        {/* Overlay stack — same intensity on every device so text stays
            legible regardless of the image behind it. */}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
      </div>

      {/*
        Content layer:
        - Balanced vertical padding on every breakpoint (no cramped mobile).
        - Max-width caps line length so headlines look intentional on wide
          screens instead of stretching.
      */}
      <div className="relative mx-auto w-full max-w-[1400px] px-5 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-12 lg:pb-28 lg:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2 text-white/80"
        >
          <MapPin className="h-4 w-4 text-[#D9BA80]" />
          <span className="text-xs font-medium uppercase tracking-[0.25em]">{hero.location}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-3xl font-serif text-4xl font-light leading-[1.08] text-white sm:text-5xl lg:text-[80px]"
        >
          {hero.headline}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base lg:text-lg"
        >
          {hero.subtext}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4"
        >
          <button
            onClick={() => scrollTo(hero.primaryButtonLink)}
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 text-[13px] font-medium tracking-wide text-[#221D14] shadow-[0_4px_14px_rgba(198,161,91,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:bg-[#D9BA80] hover:shadow-[0_6px_20px_rgba(198,161,91,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.98] sm:h-12 sm:px-6 sm:text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{hero.primaryButtonLabel}</span>
          </button>
          <button
            onClick={() =>
              openTalaIntent("workspace_day_pass", {
                roomType: "Day Pass",
                source: "hero",
                interest: "workspace",
              })
            }
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-5 text-[13px] font-medium tracking-wide text-white backdrop-blur-sm transition-all duration-200 hover:border-white/60 hover:bg-white/15 active:scale-[0.98] sm:h-12 sm:px-6 sm:text-sm"
          >
            <CalendarCheck className="h-4 w-4" />
            <span>{hero.secondaryButtonLabel}</span>
          </button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/60 lg:flex"
      >
        <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
        <div className="h-10 w-px bg-white/40" />
      </motion.div>
    </section>
  );
}
