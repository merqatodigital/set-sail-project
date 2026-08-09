// Resort operational dates must use Asia/Manila explicitly, not implicit
// UTC/date-string behavior. Cloudflare Worker runtimes are UTC, so relying on
// `new Date().toISOString()` or local getters shifts "today" by several hours
// around midnight relative to the resort's actual local day.

const RESORT_TZ = "Asia/Manila";

/** Current resort-local date as YYYY-MM-DD (Asia/Manila). */
export function todayManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESORT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA renders as YYYY-MM-DD
}
