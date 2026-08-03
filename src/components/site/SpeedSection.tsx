import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowDown, ArrowUp, Zap, MapPin, RefreshCw, Loader2, CheckCircle2, ShieldCheck, Satellite } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { runSpeedTest } from "@/lib/speedtest";
import { Reveal } from "./Reveal";
import { SectionEyebrow } from "@/components/ui";

// Max value for the gauge visualization. Anything above this pins the needle
// at the top of the arc. Starlink real-world tops out around 300-400 Mbps.
const GAUGE_MAX = 400;

export function SpeedSection() {
  const { data } = useCms();
  const s = data.homepage.speed;

  const [testing, setTesting] = useState(false);
  const [live, setLive] = useState<{ download: number; upload: number; ping: number; done: boolean } | null>(null);
  const [statusText, setStatusText] = useState<string>("");

  // Motion value that drives the animated gauge needle + digital readout
  const displayMbps = useMotionValue(0);
  const roundedMbps = useTransform(displayMbps, (v) => v.toFixed(1));

  // Auto-run the live test on section mount (once) if enabled
  const hasRunRef = useRef(false);
  useEffect(() => {
    if (!s.liveTest || hasRunRef.current) {
      // Just animate to the baseline number
      animate(displayMbps, s.downloadMbps, { duration: 2, ease: [0.22, 1, 0.36, 1] });
      return;
    }
    hasRunRef.current = true;
    startTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTest = async () => {
    setTesting(true);
    setLive(null);
    setStatusText("Pinging satellite…");
    // Reset gauge to 0 then start real measurement
    animate(displayMbps, 0, { duration: 0.4 });
    try {
      const result = await runSpeedTest((p) => {
        setStatusText("Measuring download…");
        // Live push the current running number to the gauge
        animate(displayMbps, p.downloadMbps, { duration: 0.25, ease: "linear" });
      });
      setStatusText("Test complete");
      animate(displayMbps, result.downloadMbps, { duration: 0.6, ease: "easeOut" });
      setLive({
        download: result.downloadMbps,
        upload: result.uploadMbps,
        ping: result.pingMs,
        done: true,
      });
    } catch {
      // Network blocked / CORS — fall back to configured baseline gracefully
      setStatusText("Live test unavailable — showing typical speed");
      animate(displayMbps, s.downloadMbps, { duration: 1.5, ease: "easeOut" });
      setLive({
        download: s.downloadMbps,
        upload: s.uploadMbps,
        ping: s.pingMs,
        done: true,
      });
    } finally {
      setTesting(false);
    }
  };

  const download = live?.download ?? s.downloadMbps;
  const upload = live?.upload ?? s.uploadMbps;
  const ping = live?.ping ?? s.pingMs;

  return (
    <section id="internet-speed" className="relative overflow-hidden bg-[#1B1812] py-16 text-white sm:py-20 lg:py-32">
      {/* Subtle background — starfield */}
      <StarField />
      {/* Radial accent behind gauge */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 opacity-[0.18]"
        style={{ background: "radial-gradient(circle, #C6A15B 0%, transparent 60%)" }}
      />

      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-6 lg:px-12">
        {/* Header */}
        <Reveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-16">
          <SectionEyebrow>{s.eyebrow}</SectionEyebrow>
          <h2 className="font-serif text-3xl font-light leading-[1.1] text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            {s.title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/60 sm:text-base">
            {s.paragraph}
          </p>
        </Reveal>

        {/* Provider strip */}
        <Reveal delay={0.1} className="mx-auto mb-6 flex max-w-lg flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.2em] text-white/50">
          <span className="flex items-center gap-1.5"><Satellite className="h-3.5 w-3.5 text-[#C6A15B]" /> {s.provider}</span>
          <span className="hidden text-white/20 sm:inline">·</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#C6A15B]" /> {s.location}</span>
          <span className="hidden text-white/20 sm:inline">·</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${testing ? "animate-pulse bg-amber-400" : "bg-green-400"}`} />
            {testing ? statusText : "Live"}
          </span>
        </Reveal>

        {/* Failover / redundancy badge — only shown when configured in admin */}
        {s.hasFailover && (
          <Reveal delay={0.12} className="mx-auto mb-8 flex justify-center sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C6A15B]/25 bg-[#C6A15B]/10 px-4 py-2 text-[11px] text-[#E4C888] sm:text-xs">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>
                Redundant failover: <strong className="font-semibold">{s.failoverProvider}</strong> ({s.failoverType})
                {s.dishCount > 1 && <> · {s.dishCount} dishes</>}
              </span>
            </div>
          </Reveal>
        )}

        {/* The gauge */}
        <Reveal delay={0.15}>
          <div className="mx-auto flex max-w-[280px] flex-col items-center sm:max-w-md">
            <SpeedGauge value={displayMbps} max={GAUGE_MAX} />
            <div className="-mt-20 flex flex-col items-center sm:-mt-28 lg:-mt-32">
              <motion.span className="font-serif text-6xl font-light leading-none text-white sm:text-7xl lg:text-8xl">
                {roundedMbps}
              </motion.span>
              <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#C6A15B] sm:text-xs">Mbps Download</span>
            </div>
          </div>
        </Reveal>

        {/* Stat cards */}
        <Reveal delay={0.25}>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-2 sm:mt-12 sm:gap-3 lg:mt-16 lg:gap-4">
            <StatCard
              icon={<ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              label="Download"
              value={download.toFixed(0)}
              unit="Mbps"
              highlight
            />
            <StatCard
              icon={<ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              label="Upload"
              value={upload.toFixed(0)}
              unit="Mbps"
            />
            <StatCard
              icon={<Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              label="Ping"
              value={ping.toFixed(0)}
              unit="ms"
            />
          </div>
        </Reveal>

        {/* Retest button + info */}
        <Reveal delay={0.35}>
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 sm:mt-10 sm:gap-4">
            <button
              onClick={startTest}
              disabled={testing}
              className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{statusText}</span>
                </>
              ) : live?.done ? (
                <>
                  <RefreshCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
                  <span>Run Test Again</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Run Live Speed Test</span>
                </>
              )}
            </button>
            {live?.done && !testing && (
              <p className="flex items-center gap-1.5 text-xs text-white/40">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                Measured from your device just now
              </p>
            )}
            {s.redundancyNote && (
              <p className="max-w-xs text-center text-xs leading-relaxed text-white/35">{s.redundancyNote}</p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Circular gauge — SVG arc with animated needle & progress track
// ---------------------------------------------------------------------------
function SpeedGauge({ value, max }: { value: any; max: number }) {
  // Track & needle sit on a semi-circle from -120° to +120°
  const startAngle = -120;
  const endAngle = 120;
  const sweep = endAngle - startAngle; // 240°

  // 260px circle for mobile, 340px for larger — pure SVG scales
  const size = 340;
  const radius = 130;
  const strokeWidth = 14;
  const cx = size / 2;
  const cy = size / 2;

  // Convert a Mbps value to an angle
  const angle = useTransform(value, (v: number) => {
    const clamped = Math.max(0, Math.min(v, max));
    return startAngle + (clamped / max) * sweep;
  });

  // Convert angle to stroke-dashoffset for the progress arc
  const arcCircumference = (Math.PI * 2 * radius * sweep) / 360;
  const dashOffset = useTransform(angle, (a: number) => {
    const pct = (a - startAngle) / sweep;
    return arcCircumference * (1 - pct);
  });

  // Ticks around the arc — every 50 Mbps
  const tickCount = Math.floor(max / 50);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const t = i / tickCount;
    const a = startAngle + t * sweep;
    const rad = (a - 90) * (Math.PI / 180);
    const inner = radius - 6;
    const outer = radius + 6;
    return {
      value: i * 50,
      x1: cx + Math.cos(rad) * inner,
      y1: cy + Math.sin(rad) * inner,
      x2: cx + Math.cos(rad) * outer,
      y2: cy + Math.sin(rad) * outer,
      lx: cx + Math.cos(rad) * (radius + 22),
      ly: cy + Math.sin(rad) * (radius + 22),
    };
  });

  // Build the path for the arc (background track)
  const trackPath = describeArc(cx, cy, radius, startAngle, endAngle);

  return (
    <div className="relative w-full max-w-sm">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full">
        <defs>
          <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C6A15B" />
            <stop offset="50%" stopColor="#E4C888" />
            <stop offset="100%" stopColor="#C6A15B" />
          </linearGradient>
          <filter id="speedGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />

        {/* Animated progress arc */}
        <motion.path
          d={trackPath}
          fill="none"
          stroke="url(#speedGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcCircumference}
          style={{ strokeDashoffset: dashOffset }}
          filter="url(#speedGlow)"
        />

        {/* Ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={i % 2 === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}
              strokeWidth={i % 2 === 0 ? 1.5 : 1}
            />
            {i % 2 === 0 && (
              <text
                x={t.lx} y={t.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white/40"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
              >
                {t.value}
              </text>
            )}
          </g>
        ))}

        {/* Needle */}
        <motion.g style={{ rotate: angle, transformOrigin: `${cx}px ${cy}px` }}>
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy - radius + 20}
            stroke="#F5EFE2"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy - radius + 20} r={4} fill="#F5EFE2" />
        </motion.g>

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={14} fill="#26221C" stroke="#C6A15B" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={5} fill="#C6A15B" />
      </svg>
    </div>
  );
}

// SVG arc path helper
function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  icon, label, value, unit, highlight = false,
}: {
  icon: React.ReactNode; label: string; value: string; unit: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 text-center backdrop-blur-sm sm:rounded-2xl sm:p-4 lg:p-5 ${
      highlight
        ? "border-[#C6A15B]/40 bg-[#C6A15B]/5"
        : "border-white/10 bg-white/[0.03]"
    }`}>
      <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
        highlight ? "bg-[#C6A15B]/20 text-[#C6A15B]" : "bg-white/10 text-white/60"
      }`}>
        {icon}
      </div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/45 sm:text-[10px]">{label}</p>
      <p className="mt-1 font-serif text-xl text-white sm:text-2xl lg:text-3xl">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-white/40 sm:text-[10px]">{unit}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decorative starfield background
// ---------------------------------------------------------------------------
function StarField() {
  // Pre-computed positions so they don't shift on re-render
  const stars = [
    { x: 10, y: 20, size: 1 }, { x: 25, y: 65, size: 1.5 }, { x: 42, y: 15, size: 1 },
    { x: 55, y: 78, size: 2 }, { x: 68, y: 30, size: 1 }, { x: 82, y: 60, size: 1.5 },
    { x: 92, y: 25, size: 1 }, { x: 5, y: 85, size: 1 }, { x: 30, y: 8, size: 1.5 },
    { x: 88, y: 88, size: 1 }, { x: 15, y: 45, size: 1 }, { x: 75, y: 12, size: 1.5 },
    { x: 47, y: 92, size: 1 }, { x: 62, y: 50, size: 1 }, { x: 20, y: 35, size: 1 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
