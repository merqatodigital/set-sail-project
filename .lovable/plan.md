# Final TALA Integration — One Cloudflare Brain

Goal: every TALA conversation surface on the live site (text, voice, CTA intents, Day Pass, owner Ask TALA) goes through one centralized client to the deployed Cloudflare Worker at `/api/talla/chat`. No design or copy changes, no new backend, no business-logic rewrites.

## What the code does today (verified)

- Guest text/voice already reach Cloudflare via `askCloudflareAgent` in `src/components/tala/useTalaChat.ts`, but the Worker URL comes from `getTallaAgentUrl()` in `src/lib/tallaFeatureFlag.ts`, which reads `VITE_WORKER_URL` and silently falls back to a hardcoded staging URL.
- Three more places hold their own Worker base: `src/lib/tallaCloud.ts` (`VITE_TALLA_WORKER_URL` + hardcoded fallback), `src/lib/workerApi.ts` (`VITE_WORKER_URL`), and `src/lib/cloudflareChat.ts` (a second, unused chat client).
- Owner/admin chat (`options.owner`) still routes to the Supabase `tala-chat` edge function through `askEdgeFunction` + `TALA_CHAT_ENDPOINT` in `talaConfig.ts`.
- A device-local/admin OpenRouter key path (`askOpenRouterDirect`) can still bypass Cloudflare entirely.
- Admin `askTalla` calls the Worker with no Supabase bearer token and a fixed `userId: "admin"`.
- Guest session id is already stable (`getGuestSessionId`, localStorage) — no change needed.
- Voice already sends its transcript through the same `chat.send`, and Day Pass already goes through `requestDayPass` → `askCloudflareAgent`, with food writing only to `tala_food_orders`.

## Changes

1. **One TALA client** — add `src/lib/talaClient.ts` as the single place the browser talks to the Worker: reads `VITE_TALA_WORKER_URL` only, throws a clear configuration error when missing (no fallback to a hardcoded staging host or the Lovable domain), and exposes one `talaChat({ message, role, userId, tenantId, model, authToken })` calling `${base}/api/talla/chat`.
2. **Point everything at it** — `useTalaChat` (guest + owner), `tallaCloud.ts` (`askTalla`, health, briefing), and `workerApi.ts` all resolve their base from the new client/env var. Delete the duplicate `src/lib/cloudflareChat.ts` and reduce `tallaFeatureFlag.ts` to a re-export of the single URL resolver (keeping imports intact).
3. **Retire the Supabase brain path** — remove `askEdgeFunction` and the direct-OpenRouter browser path from `useTalaChat`; owner turns use the same Worker call with `role: "owner"`. `TALA_CHAT_ENDPOINT` / anon-key chat constants are dropped from `talaConfig.ts`. The `supabase/functions/tala-chat` files stay on disk untouched but are no longer called by the frontend. Supabase remains the operational database.
4. **Owner JWT forwarding** — owner/admin calls attach `Authorization: Bearer <current Supabase access token>` from the existing session (`supabase.auth.getSession()`), and use the authenticated user id as `userId` so the Durable Object keeps one owner session. No service-role key in the browser, no new login, no dev bypass.
5. **CTA intent routing** — audit the existing `openTalaIntent` call sites (Hero, Rooms, Packages, Pricing, CtaFooter, Navbar, NotFound) and the widget's intent handler so each known intent sends its structured message instead of a generic greeting: day pass → structured form, room/availability → room_booking, packages → package_booking, plus food, tour, and rental intents where those CTAs exist. Wiring only — no visual changes.
6. **Session continuity** — keep the existing localStorage guest id and pass it on every turn (text, voice, CTA, Day Pass) so the Durable Object retains name, contact, reference, and stay state.
7. **Env + config** — add `VITE_TALA_WORKER_URL` pointing at the deployed Worker; keep old names working only as a deprecated read if already set, and update `src/vite-env.d.ts` typings.
8. **Verify** — check CORS on the real browser → Worker path from the live origin (the Worker already allows `*` plus `X-Dev-Tenant`, so a Worker change is expected only if a header is rejected), then run a 4-turn text test, a 2-turn voice test, and a Day Pass CTA test in the preview; finish with typecheck and production build.

## Out of scope

No redesign, no new copy, no TALA prompt/tool changes, no schema changes, no proxying through Lovable.