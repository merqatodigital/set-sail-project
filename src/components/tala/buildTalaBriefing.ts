import type { OperationsSnapshot } from "@/lib/opsRepo";

// ---------------------------------------------------------------------------
// TALA morning briefing — COMPUTED, not LLM-generated (phase 1).
// Reuses the exact same math as OperationsDashboard.tsx so the brief her
// operator reads matches the numbers on the Overview. No new infrastructure:
// runs in the browser when you click "Generate briefing" in the admin console.
//
// Operations data moved out of cms_data into its own admin-only tables (see
// the operations_tables migration); this now takes that snapshot directly
// instead of the full CmsData.
//
// Phase 2 (later): hand this snapshot to the tala-chat edge function and let
// TALA turn it into a warm narrative. For now we compute it deterministically.
// ---------------------------------------------------------------------------

export interface TalaBriefingSnapshot {
  briefDate: string;
  inHouse: number;
  arrivalsToday: number;
  departuresToday: number;
  toursToday: number;
  bikesOut: number;
  revenue30: number;
  expenses30: number;
  bookings30: number;
  unpaidPayroll: number;
  activeStaff: number;
  highlights: string[];
  /** Plain-language narrative, built from the numbers above. */
  summary: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function php(n: number): string {
  return "₱" + Math.round(n).toLocaleString("en-PH");
}

export function computeBriefing(ops: OperationsSnapshot): TalaBriefingSnapshot {
  const today = todayISO();
  const days30 = 30 * 86400000;
  const now = Date.now();

  const arrivals = ops.bookings.filter(
    (b) => b.checkIn === today && b.status !== "cancelled",
  );
  const departures = ops.bookings.filter(
    (b) => b.checkOut === today && b.status !== "cancelled",
  );
  const tourToday = ops.tourBookings.filter(
    (t) => t.date === today && t.status !== "cancelled",
  );
  const bikesOut = ops.motorbikes.filter((b) => b.status === "rented").length;

  const revenue = ops.payments
    .filter((p) => p.direction === "in" && new Date(p.date).getTime() > now - days30)
    .reduce((s, p) => s + p.amount, 0);
  const expenses = ops.payments
    .filter((p) => p.direction === "out" && new Date(p.date).getTime() > now - days30)
    .reduce((s, p) => s + p.amount, 0);
  const bookings30 = ops.bookings.filter(
    (b) => new Date(b.createdAt).getTime() > now - days30,
  ).length;
  const inHouse = ops.bookings.filter((b) => b.status === "checked_in").length;
  const unpaidPayroll = ops.payRecords
    .filter((p) => !p.paid)
    .reduce((s, p) => s + p.amount, 0);
  const activeStaff = ops.staff.filter((s) => s.active).length;

  const highlights: string[] = [];
  if (arrivals.length)
    highlights.push(
      `${arrivals.length} arrival${arrivals.length > 1 ? "s" : ""} today`,
    );
  if (departures.length)
    highlights.push(
      `${departures.length} departure${departures.length > 1 ? "s" : ""} today`,
    );
  if (tourToday.length)
    highlights.push(`${tourToday.length} tour${tourToday.length > 1 ? "s" : ""} running`);
  if (bikesOut) highlights.push(`${bikesOut} bike${bikesOut > 1 ? "s" : ""} out`);
  if (inHouse) highlights.push(`${inHouse} guest${inHouse > 1 ? "s" : ""} in-house`);
  if (unpaidPayroll)
    highlights.push(`Unpaid payroll: ${php(unpaidPayroll)}`);
  if (revenue) highlights.push(`Revenue (30d): ${php(revenue)}`);
  if (expenses) highlights.push(`Expenses (30d): ${php(expenses)}`);

  const parts: string[] = [];
  parts.push(
    `Good morning. Here is the rundown for ${today}.`,
  );
  if (inHouse) parts.push(`${inHouse} guest${inHouse > 1 ? "s" : ""} are in-house.`);
  else parts.push("No guests are in-house right now.");
  if (arrivals.length)
    parts.push(
      `${arrivals.length} arrival${arrivals.length > 1 ? "s" : ""} expected today.`,
    );
  else parts.push("No arrivals scheduled today.");
  if (departures.length)
    parts.push(
      `${departures.length} departure${departures.length > 1 ? "s" : ""} today.`,
    );
  else parts.push("No departures today.");
  if (tourToday.length)
    parts.push(`${tourToday.length} tour${tourToday.length > 1 ? "s" : ""} on the schedule.`);
  else parts.push("No tours booked today.");
  if (bikesOut) parts.push(`${bikesOut} motorbike${bikesOut > 1 ? "s" : ""} out.`);
  if (revenue || expenses)
    parts.push(
      `Last 30 days: ${php(revenue)} in, ${php(expenses)} out.`,
    );
  if (unpaidPayroll)
    parts.push(`Heads up — ${php(unpaidPayroll)} in payroll is still unpaid.`);
  parts.push(`${activeStaff} staff active.`);

  return {
    briefDate: today,
    inHouse,
    arrivalsToday: arrivals.length,
    departuresToday: departures.length,
    toursToday: tourToday.length,
    bikesOut,
    revenue30: revenue,
    expenses30: expenses,
    bookings30,
    unpaidPayroll,
    activeStaff,
    highlights,
    summary: parts.join(" "),
  };
}
