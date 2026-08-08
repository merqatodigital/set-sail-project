# TALA Staging Sync, Verification and Database Health

## What I verified before writing this plan

- **Code version**: the project is at `0e3f384` ("Work in progress"), whose parent is `9f7edd8`. Nothing is behind GitHub main, so no sync-from-GitHub is needed and no older version will be pushed over main.
- **Cloudflare TALA staging Worker** is reachable and healthy right now: `status: running`, `agent: true`, `d1: true`, `computer: enabled`, `workflows: true`. The Admin dashboard reads these live via `useTallaStatus` → `/api/health`, not hard-coded values.
- **Hermes owner UI is gone**: no Hermes Workforce or AI Command Center page or route exists. Only legacy non-UI references remain (`src/server.ts`, two TALA persona/tool files). Those stay untouched.
- **TALA Operations** already points at the Cloudflare backend (`fetchLatestBriefing`, `triggerBriefing`, `askTalla`).
- **`public.tala_knowledge` exists** with the expected fields.

## Two real blockers found

1. **Ask TALA in TALA Operations will crash at runtime.** `askTalla(...)` is called in the chat tab but is never imported in `src/admin/pages/TalaOps.tsx`; the Morning Brief functions are imported and it was left out. This throws as soon as an owner submits a question — a different crash from the fixed `modelId` one (`modelId` is now correctly read from `cms.settings.tala.modelId` in scope).
2. **`tala_knowledge` has no Data API permissions.** The table has row-security rules for read and add, but the API roles were never granted table privileges, so every Knowledge Base request fails at the permission layer. This is the real cause of the previous failing `/rest/v1/tala_knowledge` call. The Knowledge Base UI also edits and deletes entries, which currently have no matching access rule at all.

## Plan

### 1. Database protection first
Reported honestly: Lovable Cloud gives me **no snapshot or point-in-time backup I can trigger**. What I can do is export every existing table to CSV under `/mnt/documents/` as a plain-data safety copy, which I will do before anything else. No table will be dropped, truncated, reset or replaced — the only database change proposed below is additive (permissions and access rules).

### 2. Smallest safe database change
One additive migration:
- Grant Data API access on `public.tala_knowledge` to the signed-in role and the service role (read, add, edit, remove), plus read for anonymous visitors, since the public TALA concierge reads the knowledge base.
- Add the missing edit and remove access rules so the existing Knowledge Base buttons work.

No other table, function or policy is touched. No redesign, no global loosening.

### 3. One code fix
`src/admin/pages/TalaOps.tsx` — add `askTalla` to the existing `@/lib/tallaCloud` import. One line, preserves the Cloudflare architecture, no logic or design change. This is the only application file I intend to change, and it flows back through the connected GitHub workflow.

### 4. Runtime verification in the hosted app (not just a build)
Drive the real running Admin and read the browser console at each step:
- Dashboard renders; TALA / Computer / Automation / OpenRouter badges show live Worker values.
- Existing resort operational data still loads.
- TALA Operations renders with no error boundary and no `modelId` error.
- Morning Brief loads the real Workflow briefing artifact.
- Ask TALA submits, the request hits `/api/talla/chat`, and the Cloudflare TallaAgent reply is displayed.
- Knowledge Base loads with no permission/404 failure; adding an entry works.
- Owner navigation contains no Hermes Workforce and no AI Command Center.

### 5. Security note for later (report only)
`tala_knowledge` currently allows anonymous add. Acceptable while developing, must be tightened to owner-only before commercial multi-resort deployment. I will list this and similar items in the final report without changing authentication or rewriting access control in this task.

### 6. Final report
The exact PASS/FAIL report in the requested format, then stop. No dashboard redesign, no resort skills, no next phase.

## Technical details

- Migration: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.tala_knowledge TO authenticated`; `GRANT ALL ... TO service_role`; `GRANT SELECT ... TO anon`; add `UPDATE` and `DELETE` policies mirroring the existing permissive ones.
- Backup: `psql COPY (...) TO STDOUT WITH CSV HEADER` per table into `/mnt/documents/backup-<date>/`.
- Runtime test: headless browser against the running app with the existing owner session, capturing console errors and the `/api/talla/chat` network call.
- Files changed: `src/admin/pages/TalaOps.tsx` only.