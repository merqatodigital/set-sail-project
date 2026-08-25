# One TALA button on the public site

Right now three floating circles stack in the bottom-right corner of every public page:

1. **TALA widget** (dark green, sparkles) — the real agent: talks to the Cloudflare TALA brain, CTA/booking intents, Day Pass and booking forms, live knowledge base and admin data.
2. **ResortChat** (gold chat bubble) — an older, separate chat box that posts to a non-existent `/api/chat` endpoint with hardcoded quick prompts. Not agentic, no booking tools, no knowledge base.
3. **WhatsApp float** (bright green) — a link to WhatsApp, not a TALA agent.

## Change

- Keep the **TALA widget** as the single agent entry point. No design or copy changes to it.
- Remove the ResortChat mount from the public layout so its gold bubble disappears, and delete the now-unused `ResortChat` component and its `useAgentChat` hook.
- Leave the WhatsApp float in place (it is a contact channel, not TALA), but shift it so the two circles no longer overlap the way they do in the screenshot — WhatsApp stays at the bottom, TALA sits above it with clear spacing on mobile and desktop.

## Technical notes

- `src/pages/PublicLayout.tsx`: drop the `ResortChat` lazy import and its `<Suspense>` block.
- Delete `src/components/chat/ResortChat.tsx` and `src/hooks/useAgentChat.ts` (no other importers).
- Adjust the floating button offsets in `src/components/site/CtaFooter.tsx` (`WhatsAppFloat`) and `src/components/tala/TalaWidget.tsx` so they clear each other on a 394px-wide viewport.
- No backend, worker, or knowledge-base changes; TALA keeps its current Cloudflare routing.
