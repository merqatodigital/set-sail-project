import { useEffect, useState } from "react";
import { useCms } from "@/context/CmsContext";
import type { Tour, Motorbike } from "@/types/cms";
import type { PortalView } from "@/pages/Portal";
import type { PortalRecordsUI } from "@/lib/usePortalRecords";
import { getProactiveMessages, markProactiveRead, type ProactiveMessage } from "@/components/tala/talaProactive";
import { Bell, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Portal home — dashboard with service cards for in-house guests.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";
const GREEN = "#1F3D2B";

interface Props {
  guest: { phone: string; name: string };
  tours: Tour[];
  motorbikes: Motorbike[];
  records: PortalRecordsUI;
  onNavigate: (view: PortalView) => void;
}

export default function PortalHome({ guest, tours, motorbikes, records, onNavigate }: Props) {
  const { data } = useCms();
  const [proactiveMessages, setProactiveMessages] = useState<ProactiveMessage[]>([]);
  const bookings = records.bookings;
  const tourBookings = records.tourBookings;
  const rentals = records.rentals;

  const activeBooking = bookings.find(
    (b) => b.status === "confirmed" || b.status === "checked_in",
  );

  const totalBookings = bookings.length + tourBookings.length + rentals.length;

  // Load proactive messages for this guest
  useEffect(() => {
    const loadProactive = async () => {
      try {
        const msgs = await getProactiveMessages(guest.phone, guest.name, data);
        setProactiveMessages(msgs.filter((m) => !m.read));
      } catch {
        // proactive messaging must never break the portal
      }
    };
    void loadProactive();
  }, [guest.phone, guest.name, data]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold">
          Hello, {guest.name.split(" ")[0]}! <span className="inline-block">{"\u{1F44B}"}</span>
        </h1>
        <p className="mt-1 text-sm opacity-50">
          Welcome to Marina Terrace. We're here to make your stay exceptional.
        </p>
      </div>

      {/* Proactive Messages */}
      {proactiveMessages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: GOLD }}>
            <Bell className="h-4 w-4" />
            <span>Updates for you</span>
          </div>
          {proactiveMessages.slice(0, 3).map((msg) => (
            <button
              key={msg.id}
              onClick={() => {
                void markProactiveRead(msg.id);
                setProactiveMessages((prev) => prev.filter((m) => m.id !== msg.id));
              }}
              className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-white/5"
              style={{ borderColor: `${GOLD}33`, backgroundColor: `${GOLD}08` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#E8E4DD" }}>{msg.title}</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-70">{msg.message}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Current Stay Card */}
      {activeBooking && (
        <div
          className="overflow-hidden rounded-2xl shadow-lg"
          style={{ backgroundColor: DARK_CARD }}
        >
          <div className="p-5">
            <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: GOLD }}>
              Current Stay
            </p>
            <h2 className="text-xl font-semibold">{activeBooking.roomType}</h2>
            <p className="mt-1 text-xs opacity-50">Direct Booking</p>
            <div className="mt-4 flex gap-4 sm:gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-40">Check-in</p>
                <p className="text-sm font-medium">{activeBooking.checkIn}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-40">Check-out</p>
                <p className="text-sm font-medium">{activeBooking.checkOut}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-40">Guests</p>
                <p className="text-sm font-medium">{activeBooking.guests} Adults</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Cards */}
      <div>
        <h3 className="mb-3 text-base font-medium sm:text-lg">How can we help you today?</h3>
        <div className="space-y-2.5 sm:space-y-3">
          {/* View Packages */}
          <button
            onClick={() => onNavigate("packages")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD, border: `1px solid ${GOLD}33` }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F3E6}"}
            </div>
            <div>
              <p className="font-medium">All-Inclusive Packages</p>
              <p className="text-xs opacity-50">
                7-Day bundles with tours, meals & transport included
              </p>
            </div>
          </button>

          {/* Book Experiences */}
          <button
            onClick={() => onNavigate("tours")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F3D4}\uFE0F"}
            </div>
            <div>
              <p className="font-medium">Book Experiences</p>
              <p className="text-xs opacity-50">
                {tours.length} tours available — Island hopping, sunset cruise & more
              </p>
            </div>
          </button>

          {/* Rent Motorbike */}
          <button
            onClick={() => onNavigate("rentals")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F6F9}"}
            </div>
            <div>
              <p className="font-medium">Rent a Motorbike</p>
              <p className="text-xs opacity-50">
                {motorbikes.length} bikes available — Honda Click, Yamaha Mio
              </p>
            </div>
          </button>

          {/* Order Food & Drinks */}
          <button
            onClick={() => onNavigate("food")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F37D}\uFE0F"}
            </div>
            <div>
              <p className="font-medium">Order Food & Drinks</p>
              <p className="text-xs opacity-50">
                Rice meals, snacks, drinks & more — delivered to your room
              </p>
            </div>
          </button>

          {/* My Bookings */}
          <button
            onClick={() => onNavigate("bookings")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F4CB}"}
            </div>
            <div>
              <p className="font-medium">My Bookings</p>
              <p className="text-xs opacity-50">
                {totalBookings} booking{totalBookings !== 1 ? "s" : ""} on record
              </p>
            </div>
          </button>

          {/* Message Reception */}
          <button
            onClick={() => onNavigate("messages")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F4AC}"}
            </div>
            <div>
              <p className="font-medium">Message Reception</p>
              <p className="text-xs opacity-50">
                Send a message to our front desk team
              </p>
            </div>
          </button>

          {/* View Bill */}
          <button
            onClick={() => onNavigate("bill")}
            className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition hover:scale-[1.02] sm:gap-4 sm:p-4"
            style={{ backgroundColor: DARK_CARD }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:h-12 sm:w-12 sm:text-xl"
              style={{ backgroundColor: `${GOLD}22` }}
            >
              {"\u{1F4B3}"}
            </div>
            <div>
              <p className="font-medium">View Bill</p>
              <p className="text-xs opacity-50">
                See all charges, payments & balance due
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl p-2.5 text-center sm:p-3" style={{ backgroundColor: DARK_CARD }}>
          <p className="text-lg font-semibold" style={{ color: GOLD }}>
            {bookings.length}
          </p>
          <p className="text-[10px] uppercase opacity-40">Rooms</p>
        </div>
        <div className="rounded-xl p-2.5 text-center sm:p-3" style={{ backgroundColor: DARK_CARD }}>
          <p className="text-lg font-semibold" style={{ color: GOLD }}>
            {tourBookings.length}
          </p>
          <p className="text-[10px] uppercase opacity-40">Tours</p>
        </div>
        <div className="rounded-xl p-2.5 text-center sm:p-3" style={{ backgroundColor: DARK_CARD }}>
          <p className="text-lg font-semibold" style={{ color: GOLD }}>
            {rentals.length}
          </p>
          <p className="text-[10px] uppercase opacity-40">Rentals</p>
        </div>
      </div>
    </div>
  );
}
