import type { Booking, TourBooking, MotorbikeRental } from "@/types/cms";

// ---------------------------------------------------------------------------
// My Bookings — shows all bookings (room, tour, rental) for the guest.
// ---------------------------------------------------------------------------

const GOLD = "#C6A15B";
const DARK_CARD = "#16213e";

interface Props {
  guest: { phone: string; name: string };
  bookings: Booking[];
  tourBookings: TourBooking[];
  rentals: MotorbikeRental[];
  onBack: () => void;
}

function matchGuest(b: { guestPhone?: string; guestName: string }, guest: { phone: string; name: string }): boolean {
  const phoneMatch = b.guestPhone?.replace(/\s/g, "") === guest.phone.replace(/\s/g, "");
  const nameMatch = b.guestName.toLowerCase() === guest.name.toLowerCase();
  return phoneMatch || nameMatch;
}

function matchBooking(b: { guestName: string; notes?: string }, guest: { phone: string; name: string }): boolean {
  const phoneFromNotes = b.notes?.match(/Phone:\s*(.+)/i)?.[1]?.replace(/\s/g, "") || "";
  const phoneMatch = phoneFromNotes === guest.phone.replace(/\s/g, "");
  const nameMatch = b.guestName.toLowerCase() === guest.name.toLowerCase();
  return phoneMatch || nameMatch;
}

function statusColor(status: string): string {
  switch (status) {
    case "confirmed":
    case "checked_in":
    case "active":
      return "#4ade80";
    case "pending":
      return "#fbbf24";
    case "cancelled":
    case "returned":
      return "#f87171";
    case "completed":
    case "checked_out":
      return "#94a3b8";
    default:
      return "#e8e8e8";
  }
}

export default function MyBookings({ guest, bookings, tourBookings, rentals, onBack }: Props) {
  const myBookings = bookings.filter((b) => matchBooking(b, guest));
  const myTours = tourBookings.filter((b) => matchGuest(b, guest));
  const myRentals = rentals.filter((b) => matchGuest(b, guest));

  const hasBookings = myBookings.length + myTours.length + myRentals.length > 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <span>{"\u2190"}</span> Back
      </button>

      <h1 className="text-xl font-semibold">My Bookings</h1>

      {!hasBookings && (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: DARK_CARD }}>
          <p className="opacity-50">No bookings found yet.</p>
          <p className="mt-1 text-xs opacity-30">
            Book a tour or rent a motorbike to see your reservations here.
          </p>
        </div>
      )}

      {/* Room Bookings */}
      {myBookings.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-wide opacity-50">Room Bookings</h2>
          <div className="space-y-2">
            {myBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: DARK_CARD }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{b.roomType}</p>
                    <p className="text-xs opacity-50">{b.guestName}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${statusColor(b.status)}22`, color: statusColor(b.status) }}
                  >
                    {b.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-xs">
                  <div>
                    <span className="opacity-40">Check-in: </span>
                    <span>{b.checkIn}</span>
                  </div>
                  <div>
                    <span className="opacity-40">Check-out: </span>
                    <span>{b.checkOut}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs">
                  <span className="opacity-40">Amount: </span>
                  <span style={{ color: GOLD }}>{"\u20B1"}{b.amount.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[10px] opacity-30">Ref: {b.reference}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tour Bookings */}
      {myTours.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-wide opacity-50">Tour Bookings</h2>
          <div className="space-y-2">
            {myTours.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: DARK_CARD }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{b.tourName}</p>
                    <p className="text-xs opacity-50">{b.guests} pax</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${statusColor(b.status)}22`, color: statusColor(b.status) }}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="mt-3 text-xs">
                  <span className="opacity-40">Date: </span>
                  <span>{b.date}</span>
                </div>
                <div className="mt-1 text-xs">
                  <span className="opacity-40">Amount: </span>
                  <span style={{ color: GOLD }}>{"\u20B1"}{b.amount.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[10px] opacity-30">Ref: {b.reference}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motorbike Rentals */}
      {myRentals.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-wide opacity-50">Motorbike Rentals</h2>
          <div className="space-y-2">
            {myRentals.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: DARK_CARD }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{b.bikeName}</p>
                    <p className="text-xs opacity-50">{b.days} day{b.days > 1 ? "s" : ""}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${statusColor(b.status)}22`, color: statusColor(b.status) }}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-xs">
                  <div>
                    <span className="opacity-40">From: </span>
                    <span>{b.startDate}</span>
                  </div>
                  <div>
                    <span className="opacity-40">To: </span>
                    <span>{b.endDate}</span>
                  </div>
                </div>
                <div className="mt-1 text-xs">
                  <span className="opacity-40">Amount: </span>
                  <span style={{ color: GOLD }}>{"\u20B1"}{b.amount.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[10px] opacity-30">Ref: {b.reference}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
