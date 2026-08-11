# TALA Latency Fix — Streaming Text, Instant Voice, One Brain

No redesign, no new architecture. The authoritative path stays:
browser -> Cloudflare Worker `/api/talla/chat` -> TallaAgent Durable Object -> OpenRouter -> D1/tools.

## What the code actually does today (verified)

- The Worker already supports SSE: `worker/src/routes/chat.ts` honours `body.stream` / `Accept: text/event-stream` and forwards `X-Stream: 1`; `TallaAgent.streamTurn()` returns `text/event-stream` with user-visible deltas only, plus a `timing` payload (promptMs, llmMs, toolMs, totalMs).
- The frontend never uses it. `src/lib/talaClient.ts` does a single buffered `POST` and `await res.json()`, so nothing appears until the whole reply is done.
- `src/components/tala/useTalaChat.ts` still builds a full browser-side brain that the Worker ignores: a system prompt from `buildTalaSystemPrompt`, sentiment injection, time-of-day injection, weather injection, and a 3-hop tool loop. Only `lastUser.content` is ever sent. The weather fetch is started before the call and **awaited after** the reply returns, delaying display for nothing.
- `src/components/tala/useTalaVoice.ts` deliberately holds speech for `KOKORO_WAIT_CAP_MS = 3500` while the ~80 MB Kokoro model downloads, so the first spoken reply on a cold desktop load sits silent for up to 3.5s. Mobile already skips Kokoro.
- Barge-in exists only on the mic button press path (`voice.stop()` before `speech.start()`).
- Stable knowledge reaches the model through `ctx.knowledge` in `worker/src/agents/systemPrompt.ts`, which the Worker loads from the database each turn (`worker/src/db/knowledge.ts`).
- `VITE_TALA_WORKER_URL` is present in `.env` and `src/vite-env.d.ts`; `talaClient` throws instead of falling back to the Lovable origin. Deployed-env value still needs confirming at runtime.

## Changes

### 1. Stream TALA's text (frontend)
- Add `talaChatStream()` to `src/lib/talaClient.ts`: same POST with `stream: true` + `Accept: text/event-stream`, parses the SSE frames, calls `onDelta(text)` per chunk, resolves with the final text plus the Worker `timing` object. Falls back to the existing buffered call if the response isn't SSE.
- `useTalaChat.send()` appends an empty assistant message immediately and updates it on every delta, so text appears as it is generated. Keeps the same return value so no caller changes.
- Keep an `AbortController` per turn so a new utterance cancels the in-flight stream (the Worker already propagates `request.signal`).

### 2. Remove the duplicate browser brain and the weather wait
- Delete from `useTalaChat.ts`: the sentiment/time/weather prompt injections, the `wire` message assembly, and the client tool loop (`MAX_TOOL_HOPS`, `executeTalaTool` in the chat path) — none of it reaches the Worker.
- Remove the `talaWeather` import from the chat path entirely, so no unrelated network request can delay the reply.
- Keep the local audit/classification write (`talaGraph`) — it runs after the reply and never blocks it.
- `send(text, systemPrompt, options)` signature stays so `TalaWidget`, admin Ask TALA and Day Pass keep compiling; `systemPrompt` becomes ignored (documented), and `buildTalaSystemPrompt` stays for admin display use.
- Booking-draft confirm (`confirmDraft`) and lead capture stay exactly as they are.

### 3. Voice: never wait for Kokoro
- Delete the 3.5s hold in `useTalaVoice.speak()`. New behaviour: if Kokoro is loaded, use it; if not, speak the first reply immediately with the best available female browser voice, and let later replies use Kokoro once its background load finishes.
- Keep the existing background/idle Kokoro preload started when the widget opens, and keep mobile skipping Kokoro entirely.
- Keep the `reply -> first audio` telemetry (`lastTtsMs`).

### 4. Barge-in
- `stop()` already cancels queued chunks, audio element and `speechSynthesis`. Extend barge-in so it also fires on the first interim speech result (not just the mic press) and when the user starts typing, so TALA goes quiet the instant the guest speaks.
- One-press mic UX stays exactly as it is.

### 5. Knowledge — keep the one existing Worker implementation
- No new `staticKnowledge.ts`. Stable Marina Terrace / San Vicente knowledge stays exactly where it already lives on the Worker knowledge path feeding `ctx.knowledge` in `worker/src/agents/systemPrompt.ts`.
- Only change here: confirm a slow or failed knowledge read cannot stall a turn, and leave the prompt content untouched. Nothing added, nothing shortened, no second implementation.
- Volatile truth (availability, room status, bookings, guests, menu/inventory, orders, payments, maintenance, housekeeping, live status, authoritative prices) stays tool/D1/database-only.

### 6. Telemetry
- Surface, in the existing debug/console channel: send -> first streamed token, send -> complete reply, reply -> first audio, and the Worker `promptMs / llmMs / toolMs / totalMs`. No internal reasoning exposed.

### 7. Verify
Run the dev server and exercise, in the browser: "What is Marina Terrace?", "How do I get to San Vicente from El Nido?", "What rooms do you have?", one live operational question, a cold-load desktop voice test, a barge-in test, and a mobile-emulation test; confirm the Network panel shows exactly one TALA chat route (the Worker). Finish with typecheck and a production build.

## Known external blocker

Any Worker-side memory/prompt change only takes effect after a Cloudflare deploy (`npx wrangler deploy --config worker/wrangler.jsonc`), which needs your Cloudflare credentials. All frontend streaming/voice fixes take effect immediately, and streaming works against the already-deployed Worker because SSE support is already live there.

## Out of scope

No design, copy, branding, navigation, homepage, admin layout, pricing presentation, rooms, blog or workspace changes. No Supabase `tala-chat` brain revival, no browser-side OpenRouter call, no API keys in the bundle, no database structure deletions.
