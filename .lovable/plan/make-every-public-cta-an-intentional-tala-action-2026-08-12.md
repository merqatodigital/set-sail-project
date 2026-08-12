# Make every public CTA an intentional TALA action

No redesign. Same layout, copy, cards, pricing, navigation, sections. Only the wiring between a click, TALA's context, and the action changes.

## Current state (verified in code)

Working already:
- Structured forms exist: `DayPassForm` for `workspace_day_pass`, `BookingRequestForm` for `room_booking` / `package_booking`, rendered from widget intent state.
- Pricing Day Pass sends `roomType: "Day Pass"`; Weekly Sprint / Deep Work Month send `stayPlan`; 3/7/15-Day packages send `packageName`; the room CTA sends room + dates + guests.
- The green floating button is a real WhatsApp link; the orb is the only TALA launcher, with a single open-listener.
- Kokoro is disabled on the public widget.

Still broken or incomplete:
1. **Closing "Apply for an Extended Stay / Book Now"** fires a room booking with an empty context, so the form opens with no offer selected and no extended-stay signal — the visitor has to explain what they clicked.
2. **No section/page source context.** Nothing tells TALA which section a click came from (workspace, kitchen, stay, pricing, packages, 404), so general-help chats start cold.
3. **The in-chat draft path is still inert** — nothing in the app ever sets `pendingDraft`, so a conversation that turns into a booking ("I want a month") never escalates into a form.
4. Header and footer general CTAs submit a canned sentence with no context hints.
5. Guest Portal package CTA is already correct and stays as is.

## What gets built

**A. Intent context extension (no new intent kinds)**

Add `source` (section/page id) and `interest` (`workspace` | `long_stay` | `general`) to the intent context. The four existing kinds stay the only kinds.

**B. Closing CTA fixed**

The closing button opens a booking intent tagged as long-stay with its source, no fake offer. The booking form opens in an "offer not chosen yet" state whose offer selector is populated from live CMS rooms, stay plans and packages. Picking one fills the same request payload. No new copy beyond existing field labels.

**C. Conversation to form escalation**

When a chat turn produces a booking draft (the existing Worker draft path, plus a client-side detector for a clear booking ask that names a known CMS offer), the booking form opens prefilled with what TALA already knows. General questions — internet, airport distance, rooftop work, San Vicente, getting here from El Nido, tours, kitchen, long stays — keep answering conversationally with no form.

**D. Handoff**

When TALA has no tool for a request, it states what it can do and offers the configured WhatsApp/reception handoff. No fabricated confirmations.

**E. Context hygiene**

Every CTA click replaces transient intent; closing and resetting clear it. Verified that a 3-Day All-Inclusive selection cannot leak into a later Weekly Sprint click.

**F. Direct navigation and external actions stay direct**

Unchanged: Guest Portal, Blog, legal pages, in-page anchors, phone, email, socials, hero WhatsApp CTA, green WhatsApp float, speed-test retest, FAQ accordions.

## Verification

Browser tests at 1280 and 390 across every meaningful public CTA: header Talk to TALA, header Guest Portal, mobile-menu equivalents, hero primary scroll, hero Day Pass, room booking, pricing Day Pass, Weekly Sprint, Deep Work Month, 3/7/15-Day packages, closing Extended Stay / Book Now, closing Guest Portal, footer Book with TALA, footer nav/legal/phone/email/socials, green WhatsApp float, TALA orb open/close/reopen, 404 CTA. For each: correct destination, correct intent with the exact item preserved, one action only, no stale intent, form only where required, conversational reply where a form would be wrong, no freeze, no horizontal overflow. Backend checked for exactly one pending request per submit.

## Technical notes

- Files touched: the TALA intent contract, widget, booking form and chat hook, plus intent-only edits in the closing/footer, navbar, hero, rooms, pricing, packages sections and the 404 page.
- No schema change, no new backend, no worker redesign; the database and CMS stay authoritative for offers and pricing.
- Side note, not changed without your go-ahead: the fallback closing-CTA label in the default data reads "Apply for an n Stay / Book Now" — the word looks truncated. Live copy comes from the CMS, so I will leave the text alone unless you ask.