# Deploy tala-chat edge function (no code changes)

Deploy-only task. No source, SQL, frontend, or Cloudflare changes.

## What gets deployed

`supabase/functions/tala-chat/index.ts` exactly as it stands in the working tree (fix commit `db70112`). Verified in the file already:

- `nomads.merqato.digital` is in the allowed-origins list
- the OPTIONS/preflight and JSON responses set `Access-Control-Allow-Origin` per request

## Steps

1. Deploy only the `tala-chat` function to the connected backend.
2. Confirm the function's "Last updated" timestamp moves to now.
3. Send a live request with `Origin: https://nomads.merqato.digital` and confirm the response echoes that exact origin in `Access-Control-Allow-Origin`.
4. Send a real "Hello TALA" chat request and confirm a non-empty reply comes back (not a 5xx or empty body).

## Report

Only:

```text
DEPLOYED: YES/NO
CORS: PASS/FAIL
LIVE TALA: PASS/FAIL
```
