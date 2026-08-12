# Fix the CTA → TALA booking flow

No redesign. Same layout, copy, branding, cards. Only the wiring between a clicked button, TALA, and the booking request changes.

## What is actually broken (verified in code)

1. **The in-chat booking form cannot ever appear.** `useTalaChat` declares `pendingDraft` but nothing ever sets it — only `setPendingDraft(null)` exists. The `BookingFormCard` in the widget is therefore dead code. This is the missing bridge.
2. **Only the Day Pass intent survives into the widget.** In `TalaWidget`, intent state is kept for `workspace_day_pass` only; `room_booking` and `package_booking` are turned into a chat sentence and then `setIntent(null)`. So the exact room / stay plan / package exists only as free text, and no structured form is shown.
3. **The green floating button is a second TALA launcher.** `WhatsAppFloat` is gated on the WhatsApp setting and styled as WhatsApp, but its click fires `openTalaIntent("general_help")`. Two floating buttons open the same chat.
4. **Pricing Day Pass CTA passes the card title as roomType** instead of the required `"Day Pass"`, and weekly/monthly stay plans are sent as `package_booking` with no signal that they are stay plans.
5. The Worker already carries the live CMS offer catalog (stay plans + all-inclusive packages) in its knowledge, so "that package does not exist" is a client-side context loss, not missing backend knowledge.

## What gets built

**A. Structured booking form restored inside TALA**

Add a `BookingRequestForm` in the widget, built from the existing `BookingFormCard` fields and the existing `DayPassForm` submit pattern. It renders when the open intent is `room_booking` or `package_booking`, prefilled with the exact selected item:

- selected room / stay plan / package (read-only, exactly as clicked)
- guest name, email, WhatsApp/phone
- check-in, check-out, guests (prefilled when the CTA already knew them)
- optional digital-nomad / working-here flags and optional tour interests (existing fields)

Submit goes through the same Cloudflare path `requestDayPass` already uses (structured message → `requestRoomBooking`), producing exactly one pending request with the selected offer name in the plan field. Guarded against double submit. Status shown is whatever the backend returns — never a fabricated confirmation. Prices stay backend/CMS-derived; nothing hard-coded.

The existing `chat.pendingDraft` path stays wired, so if the Worker returns a draft that card still renders.

**B. Intent plumbing that never loses or leaks the selection**

- Widget keeps the normalized intent for all kinds, not just Day Pass.
- Intent is cleared on close, on reset, and replaced on each new CTA click, so a previous package never leaks into a new conversation.
- `general_help` and free-typed chat behave exactly as today.

**C. CTA corrections (minimal)**

- Pricing Day Pass → `workspace_day_pass` with `roomType: "Day Pass"`.
- Weekly Sprint / Deep Work Month → keep the exact name, tagged as an advertised stay plan so TALA acknowledges it instead of denying it.
- 3/7/15-Day All-Inclusive → `package_booking` with the exact `packageName`.
- Room CTA → `room_booking` with exact room, check-in, check-out, guests.
- Header Talk to TALA, footer Book with TALA, closing Book Now → open TALA with a clean stay/booking start.
- Guest Portal links stay plain navigation; hero WhatsApp CTA keeps its configured behavior.
- Green floating button returns to being a real WhatsApp link (its setting and styling already say WhatsApp), leaving exactly one TALA launcher.

**D. Responsiveness**

Kokoro is already disabled on the public widget (`active: false`) — that stays. Verify single widget mount, single chat listener, one request per action, and that the form scrolls inside the widget without horizontal overflow on mobile.

## Verification

Playwright, desktop 1280 and mobile emulation, for all 16 CTA/action paths: header TALA, header portal, hero WhatsApp, hero Day Pass, room booking, pricing Day Pass, Weekly Sprint, Deep Work Month, 3/7/15-Day packages, closing Book Now, closing portal, footer Book with TALA, floating action, widget launcher close/reopen. For each: correct destination, exact item preserved, one interaction, one request, form appears and is prefilled where expected, no freeze. Backend checked for exactly one pending row per submit and no duplicates.

## Technical notes

- Files touched: `src/components/tala/TalaWidget.tsx`, `src/components/tala/talaIntent.ts`, `src/components/tala/useTalaChat.ts`, plus one-line intent fixes in `PricingSection.tsx`, `PackagesSection.tsx`, `RoomsSection.tsx`, `CtaFooter.tsx`, `Navbar.tsx`, `Hero.tsx`.
- No new booking backend, no schema change, no worker redesign; Supabase/CMS stays authoritative.