# Sync main, fix Cloudflare staging secret, deploy, prove Phase 2

## Verified now (read-only)

- GITHUB SYNC: PASS — workspace HEAD is `77dedc4` ("Merge remote-tracking branch 'origin/main'").
- PHASE 2 CODE PRESENT: YES — `worker/src/db/operations.ts` and `worker/src/agents/tools/operationsSupabaseTool.ts` both exist; `getResortOperationsTool` is imported and pushed into the tool registry in `worker/src/agents/tools/index.ts`; `TallaAgent` passes `env` into `ToolContext`; bookings are read server-side from Supabase REST inside the Worker, scoped to `marina_terrace`.
- SUPABASE backend key: available securely in my server sandbox. I never print, echo, or commit it.
- CLOUDFLARE TOKEN AVAILABLE: NO — no `CLOUDFLARE_API_TOKEN` and no wrangler login here. This is the only blocker.

STEP 1 passes, so nothing stops the deploy except Cloudflare access.

## The one action needed from you

Save a Cloudflare API token in Lovable as the secret `CLOUDFLARE_API_TOKEN`, with the minimum permissions to manage this Worker: **Workers Scripts: Edit** plus **Account Settings: Read** (account `2a51cf4fe2181cb0085fe8ffb9960009`). On your go-ahead I request it through the secure secret form. I will not ask you for the Supabase key.

## What I do once the token exists

1. Confirm the token resolves to the account owning `talla-agent-staging`, and that this Worker serves `talla-agent-staging.merqato-digital.workers.dev`.
2. Pipe the sandbox-held backend key into Cloudflare from stdin — value never rendered:
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.staging.jsonc`.
   `SUPABASE_ANON_KEY` untouched; nothing privileged goes into any `VITE_` variable.
3. `wrangler secret list` to confirm **names only**.
4. `npx wrangler deploy --config wrangler.staging.jsonc` from the synced `77dedc4` tree.
5. Prove the deployed Worker reads `public.bookings` at HTTP 200 (not 401), and capture real in-house count, arrivals tomorrow, departures tomorrow (Manila). Zero rows counts only with a 200.
6. Run the four exact questions through Admin → Ask TALA → `/api/talla/chat` → TallaAgent → `getResortOperations` → Supabase → observation → answer. For each: tool executed, HTTP 200, `marina_terrace` scope, counts matching the database, and the answer using the live observation.
7. Regression: Phase 1 `tala_knowledge` read, Ask TALA 200, D1 tools, Computer staying lazy during normal chat, worker typecheck, worker tests, frontend build.
8. Return the final report in your exact requested format.

## If you would rather not issue a Cloudflare token

Run on your machine, then I take over from step 5:

```
cd worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.staging.jsonc
npx wrangler deploy --config wrangler.staging.jsonc
```

## Scope

Credential/deploy only. No product code, schema, Admin, or TallaAgent architecture changes; no Phase 3. If the valid credential exposes a genuine runtime bug, minimum fix, tested, committed, SHA reported, no force-push. No meaningless commit otherwise.
