# Cloudflare Staging Supabase Key — Resolution Path

## What I verified

- The privileged backend service-role credential **is available to me** inside the server sandbox as `SUPABASE_SERVICE_ROLE_KEY`. I never print, echo, commit, or place it in any `VITE_` variable.
- **Cloudflare access is not available**: no `CLOUDFLARE_API_TOKEN` and no wrangler login in this environment. That is now the only blocker — not the Supabase key.
- Staging target confirmed: `worker/wrangler.staging.jsonc` → Worker `talla-agent-staging`, no `[env.*]` blocks, so no `--env` flag. `SUPABASE_ANON_KEY` stays untouched.
- Note: `getResortOperations` and any Supabase `bookings` read do not exist in `worker/src` in this workspace, and commit `e188583` is not present here. Phase 2 code must reach this workspace (or be verified against the deployed Worker built from your machine) before runtime proof can pass.

## The one action needed from you

Create a Cloudflare API token with **Workers Scripts: Edit** (plus Account Settings: Read) for account `2a51cf4fe2181cb0085fe8ffb9960009`, then save it in Lovable as the secret `CLOUDFLARE_API_TOKEN`. I will request it through the secure secret form on your go-ahead.

That single token lets me do everything else without you touching a dashboard again, and without the Supabase key ever leaving the server sandbox.

## What I do once the token exists

1. Pipe the sandbox-held key straight into Cloudflare — value never rendered:
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.staging.jsonc` fed from stdin.
2. Confirm with `wrangler secret list` (names only) that `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` are both present.
3. `npx wrangler deploy --config wrangler.staging.jsonc` so the secret applies to the live Worker.
4. Prove the key itself is valid by a direct authenticated `bookings` read (expect HTTP 200), then prove the **deployed Worker** reads bookings at HTTP 200.
5. Capture real ground truth from the database for Manila "today/tomorrow": in-house count, arrivals tomorrow, departures tomorrow.
6. Run the four questions through Admin → Ask TALA → `/api/talla/chat` → TallaAgent → operations tool → answer, checking for each: tool executed, HTTP 200, counts matching the database, and the answer using the live result. Zero rows is reported as a real result with the 200 shown.
7. Regression: Phase 1 `tala_knowledge` read, Ask TALA HTTP 200, D1 tools, Computer staying lazy during normal chat, worker typecheck/tests, frontend build.

## If you would rather not issue a Cloudflare token

Then the exact action is, on your machine:

```
cd worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.staging.jsonc
npx wrangler deploy --config wrangler.staging.jsonc
```

and paste the key at the prompt. I then take over from step 4.

## Scope

No product code, schema, Admin, or TallaAgent architecture changes. No Phase 3. A secret/deploy-only fix gets no commit; a genuine runtime-proven bug gets a minimum fix, tested, with the SHA reported.
