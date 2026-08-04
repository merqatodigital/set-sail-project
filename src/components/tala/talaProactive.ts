import { supabase, isSupabaseConnected } from "@/lib/supabase";
import type { CmsData, Booking, TourBooking, FoodOrder } from "@/types/cms";

// ---------------------------------------------------------------------------
// TALA Proactive Outreach System
//
// Checks guest status and generates proactive messages:
// - Check-in reminders (day before arrival)
// - Check-out reminders (night before departure)
// - Tour follow-ups (after tour date)
// - Low inventory alerts
// - Meal time suggestions
// - Sunset session reminders
//
// Messages are stored in Supabase and surfaced in the guest portal + widget.
// ---------------------------------------------------------------------------

export interface ProactiveMessage {
  id: string;
  guestPhone: string;
  guestName: string;
  type: "checkin_reminder" | "checkout_reminder" | "tour_followup" | "meal_suggestion" | "sunset_reminder" | "low_inventory" | "welcome" | "general";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  sent: boolean;
}

// In-memory cache of generated messages for the current session
let proactiveCache: ProactiveMessage[] = [];

/**
 * Generate proactive messages for a guest based on their bookings and current context.
 * Called when the guest opens the portal or TALA widget.
 */
export async function generateProactiveMessages(
  guestPhone: string,
  guestName: string,
  cms: CmsData,
): Promise<ProactiveMessage[]> {
  // Never generate personal updates without a real identity: an empty phone
  // makes notes.includes("") true for every booking, which would surface
  // another guest's stay details to an anonymous visitor.
  if (!guestName.trim() || !guestPhone.trim()) return [];

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const hour = now.getHours();
  const messages: ProactiveMessage[] = [];

  // Find guest's bookings
  const myBookings = cms.operations.bookings.filter(
    (b) => b.guestName.toLowerCase() === guestName.toLowerCase() ||
           (!!guestPhone.trim() && !!b.notes?.includes(guestPhone)),
  );

  const myTours = cms.operations.tourBookings.filter(
    (b) => b.guestPhone?.replace(/\s/g, "") === guestPhone.replace(/\s/g, "") ||
           b.guestName.toLowerCase() === guestName.toLowerCase(),
  );

  const myFoodOrders = cms.operations.foodOrders.filter(
    (o) => o.guestPhone?.replace(/\s/g, "") === guestPhone.replace(/\s/g, "") ||
           o.guestName.toLowerCase() === guestName.toLowerCase(),
  );

  // 1. Check-in reminder — day before arrival
  const arrivingTomorrow = myBookings.filter(
    (b) => b.checkIn === tomorrow && (b.status === "confirmed" || b.status === "pending"),
  );
  for (const booking of arrivingTomorrow) {
    messages.push({
      id: `proactive-${booking.id}-checkin`,
      guestPhone,
      guestName,
      type: "checkin_reminder",
      title: "Tomorrow's the Day!",
      message: `Hi ${guestName.split(" ")[0]}! Just a reminder — you're checking in tomorrow (${booking.checkIn}) at Marina Terrace. Check-in is from 1:00 PM to 9:00 PM. Let us know your estimated arrival time and we'll have everything ready for you.`,
      createdAt: now.toISOString(),
      read: false,
      sent: false,
    });
  }

  // 2. Check-out reminder — night before departure
  const departingTomorrow = myBookings.filter(
    (b) => b.checkOut === tomorrow && b.status === "checked_in",
  );
  for (const booking of departingTomorrow) {
    messages.push({
      id: `proactive-${booking.id}-checkout`,
      guestPhone,
      guestName,
      type: "checkout_reminder",
      title: "Check-out Tomorrow",
      message: `Hi ${guestName.split(" ")[0]}! Friendly reminder that check-out is tomorrow by 10:30 AM. Need a late check-out or help with anything before you go? Just let me know.`,
      createdAt: now.toISOString(),
      read: false,
      sent: false,
    });
  }

  // 3. Welcome message — just checked in today
  const checkedInToday = myBookings.filter(
    (b) => b.checkIn === today && b.status === "checked_in",
  );
  for (const booking of checkedInToday) {
    messages.push({
      id: `proactive-${booking.id}-welcome`,
      guestPhone,
      guestName,
      type: "welcome",
      title: "Welcome to Marina Terrace!",
      message: `Welcome ${guestName.split(" ")[0]}! We're thrilled to have you. Your room is ${booking.roomType}. The rooftop workspace is open until 11 PM, and sunset sessions start around 5 PM. Need anything? I'm here 24/7.`,
      createdAt: now.toISOString(),
      read: false,
      sent: false,
    });
  }

  // 4. Tour follow-up — tour was yesterday or today
  const recentTours = myTours.filter(
    (t) => (t.date === today || t.date === yesterday) && t.status === "completed",
  );
  for (const tour of recentTours) {
    messages.push({
      id: `proactive-${tour.id}-followup`,
      guestPhone,
      guestName,
      type: "tour_followup",
      title: "How was your tour?",
      message: `Hope you had an amazing time on ${tour.tourName}! If you have a moment, we'd love to hear how it went. Any feedback helps us make it even better for the next guests.`,
      createdAt: now.toISOString(),
      read: false,
      sent: false,
    });
  }

  // 5. Meal time suggestions
  if ((hour >= 7 && hour <= 10) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 20)) {
    const activeBooking = myBookings.find(
      (b) => b.status === "checked_in" || b.status === "confirmed",
    );
    if (activeBooking) {
      const mealType = hour <= 10 ? "breakfast" : hour <= 14 ? "lunch" : "dinner";
      const menuItems = cms.operations.menuItems.filter(
        (m) => m.active && m.category === mealType,
      );
      if (menuItems.length > 0) {
        const topPicks = menuItems.slice(0, 3).map((m) => `${m.name} (P${m.price})`).join(", ");
        messages.push({
          id: `proactive-meal-${mealType}-${today}`,
          guestPhone,
          guestName,
          type: "meal_suggestion",
          title: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} is ready!`,
          message: `Hey ${guestName.split(" ")[0]}! ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} is available now. Today's picks: ${topPicks}. Want me to place an order for you?`,
          createdAt: now.toISOString(),
          read: false,
          sent: false,
        });
      }
    }
  }

  // 6. Sunset session reminder — around 4:30-5:30 PM
  if (hour >= 16 && hour <= 17) {
    const activeBooking = myBookings.find(
      (b) => b.status === "checked_in" || b.status === "confirmed",
    );
    if (activeBooking) {
      messages.push({
        id: `proactive-sunset-${today}`,
        guestPhone,
        guestName,
        type: "sunset_reminder",
        title: "Sunset Session",
        message: `The sunset session is about to start on the rooftop! Grab a drink and enjoy the view. The vinyl turntable is on and the vibe is perfect. See you up there?`,
        createdAt: now.toISOString(),
        read: false,
        sent: false,
      });
    }
  }

  // 7. Low inventory alerts — if tours are almost full
  const tomorrowTours = cms.operations.tours.filter((t) => t.active);
  for (const tour of tomorrowTours) {
    const tomorrowBookings = cms.operations.tourBookings.filter(
      (b) => b.tourId === tour.id && b.date === tomorrow && b.status === "confirmed",
    );
    const totalBooked = tomorrowBookings.reduce((s, b) => s + b.guests, 0);
    const remaining = tour.capacity - totalBooked;
    if (remaining > 0 && remaining <= 3) {
      const activeBooking = myBookings.find(
        (b) => b.status === "checked_in" || b.status === "confirmed",
      );
      if (activeBooking) {
        messages.push({
          id: `proactive-low-${tour.id}-${tomorrow}`,
          guestPhone,
          guestName,
          type: "low_inventory",
          title: "Tour Almost Full!",
          message: `Heads up — ${tour.name} for tomorrow only has ${remaining} spot${remaining > 1 ? "s" : ""} left! Want me to book you in before it fills up?`,
          createdAt: now.toISOString(),
          read: false,
          sent: false,
        });
      }
    }
  }

  return messages;
}

/**
 * Store proactive messages in Supabase (best-effort, never blocks).
 */
export async function storeProactiveMessages(messages: ProactiveMessage[]): Promise<void> {
  if (!isSupabaseConnected() || !supabase || messages.length === 0) return;
  try {
    const rows = messages.map((m) => ({
      id: m.id,
      guest_phone: m.guestPhone,
      guest_name: m.guestName,
      type: m.type,
      title: m.title,
      message: m.message,
      created_at: m.createdAt,
      read: false,
      sent: false,
    }));
    // Upsert — don't duplicate if already stored
    await supabase.from("tala_proactive_messages").upsert(rows, { onConflict: "id" });
  } catch {
    // proactive messaging must never break the chat
  }
}

/**
 * Fetch stored proactive messages for a guest from Supabase.
 */
export async function fetchProactiveMessages(
  guestPhone: string,
): Promise<ProactiveMessage[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  try {
    const { data } = await supabase
      .from("tala_proactive_messages")
      .select("*")
      .eq("guest_phone", guestPhone.replace(/\s/g, ""))
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      guestPhone: r.guest_phone as string,
      guestName: r.guest_name as string,
      type: r.type as ProactiveMessage["type"],
      title: r.title as string,
      message: r.message as string,
      createdAt: r.created_at as string,
      read: r.read as boolean,
      sent: r.sent as boolean,
    }));
  } catch {
    return [];
  }
}

/**
 * Mark a proactive message as read.
 */
export async function markProactiveRead(messageId: string): Promise<void> {
  if (!isSupabaseConnected() || !supabase) return;
  try {
    await supabase
      .from("tala_proactive_messages")
      .update({ read: true })
      .eq("id", messageId);
  } catch {
    // best-effort
  }
}

/**
 * Get proactive messages for a guest — combines freshly generated + stored.
 * Deduplicates by id.
 */
export async function getProactiveMessages(
  guestPhone: string,
  guestName: string,
  cms: CmsData,
): Promise<ProactiveMessage[]> {
  const [generated, stored] = await Promise.all([
    generateProactiveMessages(guestPhone, guestName, cms),
    fetchProactiveMessages(guestPhone),
  ]);

  // Merge: generated first, then stored (skip duplicates)
  const seen = new Set(generated.map((m) => m.id));
  const merged = [...generated];
  for (const s of stored) {
    if (!seen.has(s.id)) {
      merged.push(s);
      seen.add(s.id);
    }
  }

  // Store newly generated ones
  const newOnes = generated.filter((m) => !stored.some((s) => s.id === m.id));
  if (newOnes.length > 0) {
    void storeProactiveMessages(newOnes);
  }

  proactiveCache = merged;
  return merged;
}
