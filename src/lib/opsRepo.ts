import type {
  Booking,
  Guest,
  Motorbike,
  MotorbikeRental,
  PayRecord,
  Payment,
  Shift,
  StaffMember,
  Tour,
  TourBooking,
} from "@/types/cms";
import { supabase, isSupabaseConnected } from "./supabase";

// ---------------------------------------------------------------------------
// Operations repository — typed CRUD against the tables created by the
// operations_tables migration. Replaces reading/writing
// cms.operations.* + useCms().update() for these ten entities, which used
// to live inside the single public-SELECT-able cms_data JSON blob.
//
// Every table here is admin-only (RLS via has_role), so every function in
// this file only works from an authenticated admin session — that's every
// admin page and TALA's operator tools, never the public guest widget.
// ---------------------------------------------------------------------------

function db() {
  if (!isSupabaseConnected() || !supabase) throw new Error("Supabase is not connected");
  return supabase;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

// --- Guests ------------------------------------------------------------
function guestFromRow(r: any): Guest {
  return {
    id: r.id,
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    country: str(r.country),
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}
function guestToRow(g: Guest) {
  return {
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    country: g.country,
    notes: g.notes,
  };
}
export async function listGuests(): Promise<Guest[]> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(guestFromRow);
}
export async function upsertGuest(g: Guest): Promise<boolean> {
  const { error } = await db().from("guests").upsert(guestToRow(g));
  return !error;
}
export async function deleteGuest(id: string): Promise<boolean> {
  const { error } = await db().from("guests").delete().eq("id", id);
  return !error;
}

// --- Bookings ------------------------------------------------------------
function bookingFromRow(r: any): Booking {
  return {
    id: r.id,
    reference: str(r.reference),
    guestId: str(r.guest_id),
    guestName: str(r.guest_name),
    guestPhone: str(r.guest_phone),
    roomType: str(r.room_type),
    checkIn: str(r.check_in),
    checkOut: str(r.check_out),
    guests: num(r.guests, 1),
    amount: num(r.amount),
    paidAmount: num(r.paid_amount),
    status: r.status,
    source: r.source,
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}
function bookingToRow(b: Booking) {
  return {
    id: b.id,
    reference: b.reference,
    guest_id: b.guestId,
    guest_name: b.guestName,
    guest_phone: b.guestPhone,
    room_type: b.roomType,
    check_in: b.checkIn,
    check_out: b.checkOut,
    guests: b.guests,
    amount: b.amount,
    paid_amount: b.paidAmount,
    status: b.status,
    source: b.source,
    notes: b.notes,
  };
}
export async function listBookings(): Promise<Booking[]> {
  const { data, error } = await db()
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(bookingFromRow);
}
export async function upsertBooking(b: Booking): Promise<boolean> {
  const { error } = await db().from("bookings").upsert(bookingToRow(b));
  return !error;
}
export async function deleteBooking(id: string): Promise<boolean> {
  const { error } = await db().from("bookings").delete().eq("id", id);
  return !error;
}
/**
 * Anon guests can only INSERT a pending booking (never upsert/update — see
 * the "Guests can submit a pending booking" policy), so this uses a plain
 * insert rather than upsertBooking's upsert, which would also require
 * UPDATE privilege just to plan the ON CONFLICT branch.
 */
export async function insertGuestBooking(b: Booking): Promise<boolean> {
  const { error } = await db()
    .from("bookings")
    .insert({ ...bookingToRow(b), status: "pending" });
  return !error;
}
/**
 * Room-type + date-range conflicts only (no guest name, contact, or
 * amount) — the only booking data anon can read, via the
 * room_availability_conflicts SECURITY DEFINER function. Used by TALA's
 * check_room_availability tool for both guests and admins.
 */
export async function checkBookingConflicts(
  checkIn: string,
  checkOut: string,
): Promise<{ roomType: string; checkIn: string; checkOut: string }[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase.rpc("room_availability_conflicts", {
    p_check_in: checkIn,
    p_check_out: checkOut,
  });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    roomType: str(r.room_type),
    checkIn: str(r.check_in),
    checkOut: str(r.check_out),
  }));
}

// --- Tours catalog ---------------------------------------------------------
function tourFromRow(r: any): Tour {
  return {
    id: r.id,
    name: str(r.name),
    description: str(r.description),
    duration: str(r.duration),
    price: num(r.price),
    capacity: num(r.capacity, 1),
    inclusions: Array.isArray(r.inclusions) ? r.inclusions : [],
    active: bool(r.active, true),
    boatCost: num(r.boat_cost),
    guideCost: num(r.guide_cost),
    lunchCost: num(r.lunch_cost),
    entranceFee: num(r.entrance_fee),
    order: num(r.sort_order),
  };
}
function tourToRow(t: Tour) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    duration: t.duration,
    price: t.price,
    capacity: t.capacity,
    inclusions: t.inclusions,
    active: t.active,
    sort_order: t.order,
  };
}
export async function listTours(): Promise<Tour[]> {
  const { data, error } = await db()
    .from("tours_catalog")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map(tourFromRow);
}
/**
 * Guest-facing: tours_catalog has a narrow anon-SELECT policy (active tours
 * only — see the operations_tables migration), since the catalog is public
 * marketing content, unlike the other nine operational/financial tables.
 * Used by TalaWidget's tour picker so guests can see what's on offer.
 */
export async function listPublicTours(): Promise<Tour[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tours_catalog")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map(tourFromRow);
}
export async function upsertTour(t: Tour): Promise<boolean> {
  const { error } = await db().from("tours_catalog").upsert(tourToRow(t));
  return !error;
}
export async function deleteTour(id: string): Promise<boolean> {
  const { error } = await db().from("tours_catalog").delete().eq("id", id);
  return !error;
}

// --- Tour bookings -----------------------------------------------------
function tourBookingFromRow(r: any): TourBooking {
  return {
    id: r.id,
    reference: str(r.reference),
    tourId: str(r.tour_id),
    tourName: str(r.tour_name),
    guestName: str(r.guest_name),
    guestPhone: str(r.guest_phone),
    date: str(r.date),
    guests: num(r.guests, 1),
    amount: num(r.amount),
    paidAmount: num(r.paid_amount),
    cost: num(r.cost),
    status: r.status,
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}
function tourBookingToRow(t: TourBooking) {
  return {
    id: t.id,
    reference: t.reference,
    tour_id: t.tourId,
    tour_name: t.tourName,
    guest_name: t.guestName,
    guest_phone: t.guestPhone,
    date: t.date,
    guests: t.guests,
    amount: t.amount,
    paid_amount: t.paidAmount,
    status: t.status,
    notes: t.notes,
  };
}
export async function listTourBookings(): Promise<TourBooking[]> {
  const { data, error } = await db()
    .from("tour_bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(tourBookingFromRow);
}
export async function upsertTourBooking(t: TourBooking): Promise<boolean> {
  const { error } = await db().from("tour_bookings").upsert(tourBookingToRow(t));
  return !error;
}
export async function deleteTourBooking(id: string): Promise<boolean> {
  const { error } = await db().from("tour_bookings").delete().eq("id", id);
  return !error;
}

// --- Staff -----------------------------------------------------------------
function staffFromRow(r: any): StaffMember {
  return {
    id: r.id,
    name: str(r.name),
    role: str(r.role),
    phone: str(r.phone),
    email: str(r.email),
    payType: r.pay_type,
    payRate: num(r.pay_rate),
    active: bool(r.active, true),
    hiredAt: str(r.hired_at),
    notes: str(r.notes),
  };
}
function staffToRow(s: StaffMember) {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    phone: s.phone,
    email: s.email,
    pay_type: s.payType,
    pay_rate: s.payRate,
    active: s.active,
    hired_at: s.hiredAt,
    notes: s.notes,
  };
}
export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await db().from("staff_members").select("*");
  if (error || !data) return [];
  return data.map(staffFromRow);
}
export async function upsertStaff(s: StaffMember): Promise<boolean> {
  const { error } = await db().from("staff_members").upsert(staffToRow(s));
  return !error;
}
export async function deleteStaff(id: string): Promise<boolean> {
  const { error } = await db().from("staff_members").delete().eq("id", id);
  return !error;
}

// --- Shifts ------------------------------------------------------------
function shiftFromRow(r: any): Shift {
  return {
    id: r.id,
    staffId: str(r.staff_id),
    date: str(r.date),
    startTime: str(r.start_time),
    endTime: str(r.end_time),
    hoursWorked: num(r.hours_worked),
    notes: str(r.notes),
  };
}
function shiftToRow(s: Shift) {
  return {
    id: s.id,
    staff_id: s.staffId,
    date: s.date,
    start_time: s.startTime,
    end_time: s.endTime,
    hours_worked: s.hoursWorked,
    notes: s.notes,
  };
}
export async function listShifts(): Promise<Shift[]> {
  const { data, error } = await db().from("shifts").select("*");
  if (error || !data) return [];
  return data.map(shiftFromRow);
}
export async function upsertShift(s: Shift): Promise<boolean> {
  const { error } = await db().from("shifts").upsert(shiftToRow(s));
  return !error;
}
export async function deleteShift(id: string): Promise<boolean> {
  const { error } = await db().from("shifts").delete().eq("id", id);
  return !error;
}

// --- Pay records -------------------------------------------------------
function payRecordFromRow(r: any): PayRecord {
  return {
    id: r.id,
    staffId: str(r.staff_id),
    periodStart: str(r.period_start),
    periodEnd: str(r.period_end),
    hours: num(r.hours),
    amount: num(r.amount),
    paid: bool(r.paid),
    paidAt: str(r.paid_at),
    method: r.method,
    notes: str(r.notes),
  };
}
function payRecordToRow(p: PayRecord) {
  return {
    id: p.id,
    staff_id: p.staffId,
    period_start: p.periodStart,
    period_end: p.periodEnd,
    hours: p.hours,
    amount: p.amount,
    paid: p.paid,
    paid_at: p.paidAt,
    method: p.method,
    notes: p.notes,
  };
}
export async function listPayRecords(): Promise<PayRecord[]> {
  const { data, error } = await db().from("pay_records").select("*");
  if (error || !data) return [];
  return data.map(payRecordFromRow);
}
export async function upsertPayRecord(p: PayRecord): Promise<boolean> {
  const { error } = await db().from("pay_records").upsert(payRecordToRow(p));
  return !error;
}
export async function deletePayRecord(id: string): Promise<boolean> {
  const { error } = await db().from("pay_records").delete().eq("id", id);
  return !error;
}

// --- Payments ------------------------------------------------------------
function paymentFromRow(r: any): Payment {
  return {
    id: r.id,
    reference: str(r.reference),
    date: str(r.date),
    category: r.category,
    direction: r.direction,
    amount: num(r.amount),
    method: r.method,
    relatedId: str(r.related_id),
    description: str(r.description),
    notes: str(r.notes),
  };
}
function paymentToRow(p: Payment) {
  return {
    id: p.id,
    reference: p.reference,
    date: p.date,
    category: p.category,
    direction: p.direction,
    amount: p.amount,
    method: p.method,
    related_id: p.relatedId,
    description: p.description,
    notes: p.notes,
  };
}
export async function listPayments(): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .order("date", { ascending: false });
  if (error || !data) return [];
  return data.map(paymentFromRow);
}
export async function upsertPayment(p: Payment): Promise<boolean> {
  const { error } = await db().from("payments").upsert(paymentToRow(p));
  return !error;
}
export async function deletePayment(id: string): Promise<boolean> {
  const { error } = await db().from("payments").delete().eq("id", id);
  return !error;
}

// --- Motorbikes ------------------------------------------------------------
function motorbikeFromRow(r: any): Motorbike {
  return {
    id: r.id,
    name: str(r.name),
    plate: str(r.plate),
    model: str(r.model),
    dailyRate: num(r.daily_rate),
    active: bool(r.active, true),
    status: r.status,
    notes: str(r.notes),
  };
}
function motorbikeToRow(m: Motorbike) {
  return {
    id: m.id,
    name: m.name,
    plate: m.plate,
    model: m.model,
    daily_rate: m.dailyRate,
    active: m.active,
    status: m.status,
    notes: m.notes,
  };
}
export async function listMotorbikes(): Promise<Motorbike[]> {
  const { data, error } = await db().from("motorbikes").select("*");
  if (error || !data) return [];
  return data.map(motorbikeFromRow);
}
export async function upsertMotorbike(m: Motorbike): Promise<boolean> {
  const { error } = await db().from("motorbikes").upsert(motorbikeToRow(m));
  return !error;
}
export async function deleteMotorbike(id: string): Promise<boolean> {
  const { error } = await db().from("motorbikes").delete().eq("id", id);
  return !error;
}

// --- Motorbike rentals -------------------------------------------------
function rentalFromRow(r: any): MotorbikeRental {
  return {
    id: r.id,
    reference: str(r.reference),
    bikeId: str(r.bike_id),
    bikeName: str(r.bike_name),
    guestName: str(r.guest_name),
    guestPhone: str(r.guest_phone),
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    days: num(r.days),
    amount: num(r.amount),
    paidAmount: num(r.paid_amount),
    deposit: num(r.deposit),
    status: r.status,
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}
function rentalToRow(m: MotorbikeRental) {
  return {
    id: m.id,
    reference: m.reference,
    bike_id: m.bikeId,
    bike_name: m.bikeName,
    guest_name: m.guestName,
    guest_phone: m.guestPhone,
    start_date: m.startDate,
    end_date: m.endDate,
    days: m.days,
    amount: m.amount,
    paid_amount: m.paidAmount,
    deposit: m.deposit,
    status: m.status,
    notes: m.notes,
  };
}
export async function listMotorbikeRentals(): Promise<MotorbikeRental[]> {
  const { data, error } = await db()
    .from("motorbike_rentals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rentalFromRow);
}
export async function upsertMotorbikeRental(m: MotorbikeRental): Promise<boolean> {
  const { error } = await db().from("motorbike_rentals").upsert(rentalToRow(m));
  return !error;
}
export async function deleteMotorbikeRental(id: string): Promise<boolean> {
  const { error } = await db().from("motorbike_rentals").delete().eq("id", id);
  return !error;
}

// --- Inventory (linens, towels, bathroom, food, gas, fuel, etc.) -----------
export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  unitCost: number;
  notes: string;
  updatedAt: string;
}
export type InventoryCategory =
  | "linens"
  | "towels"
  | "bathroom"
  | "food"
  | "gas"
  | "fuel"
  | "cleaning"
  | "other";
export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "linens",
  "towels",
  "bathroom",
  "food",
  "gas",
  "fuel",
  "cleaning",
  "other",
];
function inventoryCategory(v: unknown): InventoryCategory {
  return INVENTORY_CATEGORIES.includes(v as InventoryCategory) ? (v as InventoryCategory) : "other";
}
function inventoryFromRow(r: any): InventoryItem {
  return {
    id: r.id,
    name: str(r.name),
    category: inventoryCategory(r.category),
    unit: str(r.unit, "pcs"),
    quantity: num(r.quantity),
    reorderThreshold: num(r.reorder_threshold),
    unitCost: num(r.unit_cost),
    notes: str(r.notes),
    updatedAt: str(r.updated_at),
  };
}
function inventoryToRow(i: InventoryItem) {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    quantity: i.quantity,
    reorder_threshold: i.reorderThreshold,
    unit_cost: i.unitCost,
    notes: i.notes,
    updated_at: new Date().toISOString(),
  };
}
export async function listInventory(): Promise<InventoryItem[]> {
  const { data, error } = await db()
    .from("inventory_items")
    .select("*")
    .order("category", { ascending: true });
  if (error || !data) return [];
  return data.map(inventoryFromRow);
}
export async function upsertInventoryItem(i: InventoryItem): Promise<boolean> {
  const { error } = await db().from("inventory_items").upsert(inventoryToRow(i));
  return !error;
}
export async function deleteInventoryItem(id: string): Promise<boolean> {
  const { error } = await db().from("inventory_items").delete().eq("id", id);
  return !error;
}
/** Bulk import (CSV upload) — one upsert call for the whole batch. */
export async function bulkUpsertInventory(items: InventoryItem[]): Promise<boolean> {
  if (!items.length) return true;
  const { error } = await db().from("inventory_items").upsert(items.map(inventoryToRow));
  return !error;
}

// ---------------------------------------------------------------------------
// One-shot loader — mirrors the shape of the old cms.operations object so
// call sites that displayed everything together (OperationsDashboard,
// buildTalaBriefing) can load it in one place.
// ---------------------------------------------------------------------------
export interface OperationsSnapshot {
  guests: Guest[];
  bookings: Booking[];
  tours: Tour[];
  tourBookings: TourBooking[];
  staff: StaffMember[];
  shifts: Shift[];
  payRecords: PayRecord[];
  payments: Payment[];
  motorbikes: Motorbike[];
  motorbikeRentals: MotorbikeRental[];
  inventory: InventoryItem[];
}

/**
 * Every ops table is admin-only (RLS), so the guest-facing TALA widget can
 * never load a real snapshot — and doesn't need to: its only tool that used
 * to read bookings (check_room_availability) now goes through the
 * room_availability_conflicts RPC instead. This stub lets TalaToolContext
 * always have a non-null `ops` without every guest session paying for a
 * doomed-to-fail admin table fetch.
 */
export const EMPTY_OPERATIONS_SNAPSHOT: OperationsSnapshot = {
  guests: [],
  bookings: [],
  tours: [],
  tourBookings: [],
  staff: [],
  shifts: [],
  payRecords: [],
  payments: [],
  motorbikes: [],
  motorbikeRentals: [],
  inventory: [],
};

export async function loadOperationsSnapshot(): Promise<OperationsSnapshot> {
  const [
    guests,
    bookings,
    tours,
    tourBookings,
    staff,
    shifts,
    payRecords,
    payments,
    motorbikes,
    motorbikeRentals,
    inventory,
  ] = await Promise.all([
    listGuests(),
    listBookings(),
    listTours(),
    listTourBookings(),
    listStaff(),
    listShifts(),
    listPayRecords(),
    listPayments(),
    listMotorbikes(),
    listMotorbikeRentals(),
    listInventory(),
  ]);
  return {
    guests,
    bookings,
    tours,
    tourBookings,
    staff,
    shifts,
    payRecords,
    payments,
    motorbikes,
    motorbikeRentals,
    inventory,
  };
}
