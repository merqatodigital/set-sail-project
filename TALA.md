# TALA — AI Voice Concierge

TALA is the site's AI friend, guide and concierge for San Vicente, ported from
the [KAPWA Resort OS agent](https://github.com/merqatodigital/working-AI-agent).
She lives in a floating widget on every public page (the gold sparkle button
above the WhatsApp float), answers questions about the property grounded in
live CMS data (rooms, pricing, Starlink speed, FAQs), and hands guests to
WhatsApp when they're ready to book.

## Is she actually agentic?

Yes, with two real tools — this isn't just a chat completion wrapped in a
persona prompt:

- **`check_room_availability`** — reads live booking data (not the static
  text in the prompt) and tells the guest, per room, whether it's actually
  free for their dates.
- **`log_interested_guest`** — when a guest shares a name/contact and clearly
  wants a follow-up but the chat ends before they reach WhatsApp, she saves
  it to a `tala_leads` table so the human team can call them back. See it
  happen in real time in **Admin → TALA → Leads TALA has captured**.

The model decides when to call these (OpenAI-style function-calling via
OpenRouter); we execute them and hand the result back to her, and she keeps
going from there. What she does **not** have is the actual KAPWA Python
backend (LangGraph graph, approval workflow, audit trail, staff/inventory
tools) — that would need the `agent-api` service deployed somewhere, which
this integration deliberately avoids to keep everything running for free
inside the existing site.

Everything is free or open source:

| Piece | Technology | Cost |
|---|---|---|
| Brain | OpenRouter **free models** with automatic fallback chain | $0 |
| Voice out | **Kokoro-82M** (Apache-2.0) running in the visitor's browser via `kokoro-js` | $0 |
| Voice in | Browser Web Speech API (Chrome / Edge / Safari) | $0 |
| Key security | Supabase Edge Function `tala-chat` proxy | $0 |

## Picking the model — Admin → TALA

Go to `/admin/tala` in the site's admin panel. It lists **every current
OpenRouter model, free and paid, A–Z** (pulled live from OpenRouter's public
model catalog — no key needed just to list them). Pick one and a green
"Synced" indicator confirms the choice reached the live site.

**The API key is deliberately not on that page.** Every CMS setting —
including this one — is stored in a `cms_data` table that's world-readable
(the public site loads it to render itself), so a real API key typed into
any admin field would leak to every visitor. The model *choice* is not a
secret, so it's fine there; the *key* stays a Supabase secret (below), set
once, separately.

## One-time setup (production) — the API key

TALA needs your OpenRouter API key stored as a **Supabase secret** — it never
ships to the browser, and it's the only step still needed to make the chat
brain live.

1. You already have an OpenRouter key (or get one at https://openrouter.ai/keys — free models work with a $0 balance).
2. In the Supabase dashboard for project `nfirbrpnmgsrvoomtokn`:
   **Edge Functions → Secrets → Add secret** → name `OPENROUTER_API_KEY`,
   value `sk-or-...`
   (or via CLI: `supabase secrets set OPENROUTER_API_KEY=sk-or-...`)
3. Deploy the function (skip if Lovable auto-deploys it on sync):
   ```bash
   supabase functions deploy tala-chat --no-verify-jwt
   ```

That's it. The widget calls `<SUPABASE_URL>/functions/v1/tala-chat`, which
tries the Admin-selected model first, then falls back to the free-model
chain if that model is busy or retired.

## Building / local dev without the edge function

Open the widget → gear icon → paste an OpenRouter key into **Dev OpenRouter
key**. It's stored only in that browser's localStorage and the widget then
calls OpenRouter directly. Leave it empty in production.

## The voice

- Default voice is Kokoro's `af_heart` (warm, natural female). Pick others in
  the widget settings (Bella, Nicole, Aoede, British Emma).
- The ~80 MB voice model downloads in the background on first use and is
  cached by the browser afterwards. Until it's ready, TALA speaks with the
  built-in browser voice so she's never mute.
- Voice on/off and the chosen voice persist per device.

## Keeping the free models fresh

Free OpenRouter model IDs change over time. The fallback chain lives in **two
places — keep them in sync**:

- `src/components/tala/talaConfig.ts` → `TALA_FREE_MODELS`
- `supabase/functions/tala-chat/index.ts` → `FREE_MODELS`

Check current free models at https://openrouter.ai/models?q=free. If every
model in the chain is rate-limited, TALA shows a friendly "busy right now"
message.

## Where the code lives

```
src/components/tala/
├── TalaWidget.tsx     UI — launcher, chat panel, mic, settings
├── talaPersona.ts     System prompt (built from live CMS data)
├── talaConfig.ts      Models, endpoints, voices, storage keys
├── talaTools.ts       Tool schemas + execution (availability, lead capture)
├── useTalaChat.ts     Chat state, tool-calling loop, edge-function/dev-key transport
├── useTalaVoice.ts    Kokoro TTS engine + browser-voice fallback
└── useSpeechInput.ts  Web Speech API microphone input

supabase/functions/tala-chat/index.ts   OpenRouter proxy (key stays server-side)
supabase/migrations/20260722160000_create_tala_leads.sql   Leads table
```

The widget is mounted in `src/pages/PublicLayout.tsx`, so it appears on the
home page and blog but not in `/admin`.

## The tool-calling loop, in short

1. TALA's reply comes back either as text, or as one or more `tool_calls`.
2. If it's tool calls, `useTalaChat` runs them via `executeTalaTool` (browser
   side — it already has the live CMS data and a Supabase client), appends
   the results as `tool` messages, and asks the model again.
3. Repeats up to 3 times, then returns whatever text she settles on.

Not every free OpenRouter model supports function-calling. If a model
rejects the `tools` param outright (HTTP 400 mentioning tools/functions),
both the edge function and the direct-key path retry that same model without
tools before moving to the next one in the fallback chain — so an
unsupported model degrades to plain chat instead of failing outright.

## Admin access — real Supabase Auth (as of the `admin_auth_and_rls_lockdown` migration)

The admin panel used to gate `/admin` with a passkey compared in the browser
(default `5309`, committed in plain text to this repo). Postgres never saw
that check, so every admin write reached Supabase as the same `anon` role as
any site visitor — and `cms_data` (site content **and** all operations data:
bookings, payroll, revenue) was `anon`-writable with no restriction at all.

This is now real Supabase email/password auth (`src/context/AuthContext.tsx`),
checked against a `user_roles` table via `has_role(auth.uid(), 'admin')` in
RLS policies. `cms_data` writes, and reads of `tala_leads` / `tala_audit_log`
/ `tala_goals` / `tala_tasks` / `tala_briefings` / `tala_wins`, now require an
authenticated admin session. Guests can still submit a lead
(`tala_leads` INSERT) and TALA can still log a turn (`tala_audit_log`
INSERT) anonymously from the public chat widget — those stay open by design.

**To create the first admin user**, after the migration is applied and the
app is deployed with this AuthContext:

1. Supabase Dashboard → Authentication → Users → Add user (email + password).
2. Copy that user's UID.
3. SQL Editor:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('<uid>', 'admin');
   ```
4. Reload `/admin` and sign in with that email/password.

**Follow-up closed (`operations_tables` migration):** bookings, staff,
payroll, payments, motorbike rentals, guests, and the tour catalog now live
in their own tables (`bookings`, `staff_members`, `pay_records`, `payments`,
`motorbike_rentals`, `guests`, `tour_bookings`, `tours_catalog`, `shifts`),
each locked to `has_role(auth.uid(), 'admin')` for both read and write via
RLS — not just writes. `cms_data` keeps site content only. Two narrow
guest-facing exceptions remain by design: a `room_availability_conflicts`
SECURITY DEFINER function (no PII, just room type + dates) backs TALA's
`check_room_availability` tool, and guests can INSERT (never read/alter) a
`status = 'pending'` booking when they confirm a draft. `tours_catalog` also
has an anon-SELECT policy scoped to `active = true`, since the tour catalog
is public marketing content, not operational data. See
`src/lib/opsRepo.ts` for the typed repository layer every admin page and
TALA's operator tools go through now.

## The morning briefing, made "alive"

Two layers, both reading the same tables:

- **Scheduled** — a pg_cron job (`supabase/migrations/20260723093000_tala_daily_briefing_cron.sql`,
  logic updated in `20260727090000` and `20260727100000` to read the new
  operations tables instead of the old `cms_data.operations` JSON) runs
  `generate_tala_briefing()` every day at 07:00 Asia/Manila and inserts a row
  into `tala_briefings` — no click needed. Verify it's actually scheduled
  with `select * from cron.job where jobname = 'tala_daily_briefing';` in the
  SQL Editor; re-run the `cron.schedule(...)` line at the bottom of that
  migration if the row is missing (can happen after a project pause/restore).
- **Live** — Admin → TALA → Morning Brief also shows a "Right now" panel
  (`computeBriefing()` in `src/components/tala/buildTalaBriefing.ts`) that's
  always current, not just generated once a day: live San Vicente weather
  (Open-Meteo, no key, fetched client-side — `src/lib/weather.ts`), which
  room types have nobody booked in tonight, bike availability/maintenance,
  bookings still awaiting confirmation, and yesterday's logged wins.
