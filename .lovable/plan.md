# Cloudflare Staging Secret Fix + Phase 2 Verification

## What I found before planning

- This workspace does not contain commit `e188583`. Local history tops out at `396b737` (chain: `f564885` → `7e2a28e` → `4816f7c` → `396b737`).
- No `getResortOperations` tool exists anywhere in `worker/src` here, and no Worker code reads `public.bookings` (only `guestRequestTools.ts` mentions the word "bookings" in a request-type description). So the Phase 2 code is not present in this environment.
- `worker/src/env.ts` declares both `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` as optional secrets; only `SUPABASE_ANON_KEY` is currently consumed (`worker/src/auth/middleware.ts`).
- `worker/wrangler.staging.jsonc` defines Worker `talla-agent-staging`, no named environments, D1 `talla-staging-db`, DO `TALLA_AGENT`, workflows, and vars `TALLA_COMPUTER_ENABLED=true` / `ENVIRONMENT=staging`.
- This sandbox has no Cloudflare credentials (`CLOUDFLARE_API_TOKEN` unset, no wrangler login), and the privileged backend service key is not accessible to me. So I cannot set the secret or publish the Worker myself — you run those two commands.

## Steps you run locally

Confirm the environment first, then set the secret and deploy. `wrangler.staging.jsonc` has no `[env.*]` blocks, so the top-level Worker `talla-agent-staging` is the target and no `--env` flag is used.

```bash
cd worker
npx wrangler whoami
npx wrangler deployments list --config wrangler.staging.jsonc

# paste the real service-role / secret key when prompted (never echoed, never committed)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.staging.jsonc

npx wrangler secret list --config wrangler.staging.jsonc   # name-only check
npx wrangler deploy --config wrangler.staging.jsonc
```

`SUPABASE_ANON_KEY` is left untouched. Nothing is added to `.env`, Vite vars, or the repo.

## What I do after you confirm the deploy

1. Confirm the live Worker identity and health via `/api/health` on the staging URL.
2. Prove the bookings read path returns HTTP 200 rather than 401, using the deployed Worker (not a local curl to the database).
3. Establish real ground truth directly from the database — in-house count, arrivals tomorrow, departures tomorrow (Manila date) — so the agent answers can be checked against actual rows.
4. Run the four questions through the real path: Admin Ask TALA → `/api/talla/chat` → TallaAgent → the bookings-backed operations tool → answer. For each: tool actually executed, HTTP 200 observed, counts match the database, and the answer uses the result. Zero rows is reported as a valid real result with the 200 shown.
5. Regression: Phase 1 `tala_knowledge` read, Ask TALA HTTP 200, D1 operational tools, Computer staying lazy during normal chat, plus `worker` typecheck/tests and the frontend build.

## Phase 2 code gap

Because the bookings tool is absent from this workspace, step 4 cannot pass here even with a valid secret. Options at that point:
- If GitHub `main` already carries `e188583`, the workspace needs to sync from GitHub before verification — no code written by me.
- If Phase 2 lives only on your machine, push it to `main` first.

I write no code unless runtime proves an actual bug; a secret/deploy-only fix gets no commit.

## Reporting

I return exactly the requested report block, marking anything still blocked as a blocker, then stop. Phase 3 is not touched.
