// Tiny ISO date helpers for TALA flows (no date library dependency).

/** YYYY-MM-DD in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add N days to an ISO date string, returning YYYY-MM-DD. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Today as ISO YYYY-MM-DD (local). */
export function todayISO(): string {
  return toISODate(new Date());
}