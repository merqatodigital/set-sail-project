-- ===========================================================================
-- Add guest_phone to bookings — needed for WhatsApp reminders
-- ===========================================================================
-- tour_bookings and motorbike_rentals already capture a guest phone number;
-- bookings (room stays) didn't. Adding it so the new "send a WhatsApp
-- reminder" action on a pending booking has a number to send to. Additive,
-- nullable-safe (defaults to ''), no RLS changes needed — same policies as
-- the rest of the bookings table already cover it.
-- ===========================================================================

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT NOT NULL DEFAULT '';
