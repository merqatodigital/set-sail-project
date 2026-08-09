# Admin Dashboard — Owner Command Center (UI only)

Rebuild `src/admin/pages/Dashboard.tsx` into a dense, premium owner overview. No backend, Cloudflare, Supabase schema, TallaAgent, Workflow, D1, Computer, knowledge, or voice changes. TALA Operations stays the deeper workspace.

## Layout (top to bottom)

1. **TALA Briefing** — owner-facing narrative at the top. Primary source: the computed briefing (`computeBriefing(ops, rooms)`, already used on this page) rendered as prose plus a few key phrases. If the Cloudflare daily-briefing artifact is reachable from the browser, show its owner-facing text instead; on any failure it silently falls back to the computed brief. No tool names, no reasoning, no raw logs.
2. **Needs Attention** — one list built only from real exceptions already loaded: bookings awaiting confirmation, low-stock inventory, unpaid payroll, bikes in maintenance, room types open tonight, plus open guest requests / housekeeping / maintenance / food orders when those existing Worker endpoints return data. Each row links to the matching admin page. Truthful "Nothing needs your attention" empty state.
3. **Today / Tomorrow** — compact number cards: guests in-house, arrivals today, departures today, arrivals tomorrow, departures tomorrow (tomorrow figures computed from the same bookings snapshot using the existing date logic).
4. **Operations** — compact status strip for Guest Requests, Housekeeping, Maintenance, Food Orders, Inventory: open/pending count + link. If an endpoint is unavailable, that tile says so instead of showing a fake zero.
5. **TALA Activity** — recent rows from the existing `tala_audit_log` read already used by TALA Manager (intent / department / time only, no reasoning). Truthful empty state when there are none; no new table or API.
6. **System Health** — small pill row near the bottom: TALA, Supabase, Automation, Computer, OpenRouter. TALA/Automation/Computer/OpenRouter come from the existing `useTallaStatus` health poll; Supabase is derived from whether the operations snapshot loaded. Unknown stays "Unknown".

Removes from the dashboard: the current giant TALA stat grid, the CMS content-count cards, Blog Status, and Quick Tips (those pages remain in the sidebar).

## Visual direction

Keep the existing admin palette (`#26221C` ink, `#C6A15B` gold, white cards, serif headings). Tighter cards, smaller type scale, more rows per screen, no charts, no oversized status blocks. Mobile: single column with grid-based headers, `min-w-0`, truncation; desktop: two-column split for Needs Attention + Operations.

## Technical notes

- Files: `src/admin/pages/Dashboard.tsx` (rewrite), plus small presentational subcomponents under a new `src/admin/dashboard/` folder if the file grows past readability. No changes to hooks, repos, worker code, or SQL.
- Live data used: `useCms()` (rooms), `useOperations()` (bookings, tours, bikes, payments, payroll, inventory), `computeBriefing`, `useTallaStatus`, existing worker hooks (`useGuestRequests`, `useHousekeepingTasks`, `useMaintenanceRequests`, `useFoodOrders`, `useInventory`), existing `tala_audit_log` select.
- Verification: build + typecheck, then load `/admin` headless and confirm no console errors and real values render at desktop and mobile widths.
- Finish by committing and pushing to `main` (no force-push), then report files changed, live data used, build result, commit SHA, push result.