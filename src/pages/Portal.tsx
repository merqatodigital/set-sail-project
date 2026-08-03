import { useState, useCallback } from "react";
import { useCms } from "@/context/CmsContext";
import PortalLogin from "@/components/portal/PortalLogin";
import PortalHome from "@/components/portal/PortalHome";
import BookExperiences from "@/components/portal/BookExperiences";
import RentMotorbike from "@/components/portal/RentMotorbike";
import OrderFood from "@/components/portal/OrderFood";
import MessageReception from "@/components/portal/MessageReception";
import ViewBill from "@/components/portal/ViewBill";
import ViewPackages from "@/components/portal/ViewPackages";
import MyBookings from "@/components/portal/MyBookings";
import GCashQR from "@/components/portal/GCashQR";

// ---------------------------------------------------------------------------
// Guest Portal — phone-number login, book tours, rent bikes, view bookings.
// Dark theme with gold accents matching Marina Terrace branding.
// ---------------------------------------------------------------------------

export type PortalView =
  | "login"
  | "home"
  | "tours"
  | "rentals"
  | "food"
  | "messages"
  | "bill"
  | "packages"
  | "bookings"
  | "gcash";

export interface PortalGuest {
  phone: string;
  name: string;
}

export interface PortalBookingResult {
  type: "tour" | "rental";
  reference: string;
  name: string;
  date: string;
  amount: number;
  pax?: number;
  days?: number;
}

const GREEN = "#1F3D2B";
const GOLD = "#C6A15B";
const DARK = "#1a1a2e";
const DARK_CARD = "#16213e";

export default function Portal() {
  const { data } = useCms();
  const [view, setView] = useState<PortalView>("login");
  const [guest, setGuest] = useState<PortalGuest | null>(null);
  const [bookingResult, setBookingResult] = useState<PortalBookingResult | null>(null);

  const handleLogin = useCallback((phone: string, name: string) => {
    setGuest({ phone, name });
    setView("home");
  }, []);

  const handleLogout = useCallback(() => {
    setGuest(null);
    setView("login");
    setBookingResult(null);
  }, []);

  const handleBookingComplete = useCallback((result: PortalBookingResult) => {
    setBookingResult(result);
    setView("gcash");
  }, []);

  const handlePaymentDone = useCallback(() => {
    setBookingResult(null);
    setView("home");
  }, []);

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: DARK, color: "#e8e8e8" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: DARK, borderColor: `${GOLD}33` }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide" style={{ color: GOLD }}>
              MARINA TERRACE
            </span>
          </div>
          {guest && (
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-60">Hello, {guest.name}</span>
              <button
                onClick={handleLogout}
                className="rounded-full px-3 py-1 text-xs transition"
                style={{ border: `1px solid ${GOLD}55`, color: GOLD }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {view === "login" && <PortalLogin onLogin={handleLogin} />}

        {view === "home" && guest && (
          <PortalHome
            guest={guest}
            tours={data.operations.tours.filter((t) => t.active)}
            motorbikes={data.operations.motorbikes.filter((m) => m.active && m.status === "available")}
            onNavigate={setView}
          />
        )}

        {view === "tours" && guest && (
          <BookExperiences
            guest={guest}
            tours={data.operations.tours.filter((t) => t.active)}
            onComplete={handleBookingComplete}
            onBack={() => setView("home")}
          />
        )}

        {view === "rentals" && guest && (
          <RentMotorbike
            guest={guest}
            motorbikes={data.operations.motorbikes.filter((m) => m.active && m.status === "available")}
            onComplete={handleBookingComplete}
            onBack={() => setView("home")}
          />
        )}

        {view === "food" && guest && (
          <OrderFood
            guest={guest}
            onOrderComplete={() => setView("home")}
            onBack={() => setView("home")}
          />
        )}

        {view === "messages" && guest && (
          <MessageReception
            guest={guest}
            onBack={() => setView("home")}
          />
        )}

        {view === "bill" && guest && (
          <ViewBill
            guest={guest}
            bookings={data.operations.bookings}
            tourBookings={data.operations.tourBookings}
            rentals={data.operations.motorbikeRentals}
            foodOrders={data.operations.foodOrders}
            payments={data.operations.payments}
            onBack={() => setView("home")}
          />
        )}

        {view === "packages" && (
          <ViewPackages
            onBack={() => setView("home")}
          />
        )}

        {view === "bookings" && guest && (
          <MyBookings
            guest={guest}
            bookings={data.operations.bookings}
            tourBookings={data.operations.tourBookings}
            rentals={data.operations.motorbikeRentals}
            onBack={() => setView("home")}
          />
        )}

        {view === "gcash" && bookingResult && (
          <GCashQR
            booking={bookingResult}
            onDone={handlePaymentDone}
          />
        )}
      </main>
    </div>
  );
}
