# Staging Deployment Report

**Date:** August 8, 2026
**Worker:** `talla-agent-staging`
**URL:** https://talla-agent-staging.merqato-digital.workers.dev
**Cloudflare Account:** `merqato.digital@gmail.com` / Account ID `2a51cf4fe2181cb0085fe8ffb9960009`

---

## What Was Done

1. Created `wrangler.staging.jsonc` — staging-safe config (no `worker_loaders`, Computer disabled, `ENVIRONMENT=staging`)
2. Created D1 database `talla-staging-db` (`9e47f804-c263-4898-8d2c-c0f11fb2baf0`) and ran 6 migrations
3. Seeded Marina Terrace data (business hours, agent config, system prompts)
4. Set secrets: `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
5. Deployed Worker (4.19s upload, 3.07s triggers)
6. Verified all subsystems

---

## Verification Results

| Check | Result |
|-------|--------|
| Health endpoint | `200` — D1 true, agent true, workflows true, computer disabled |
| D1 read/write | `7 business hours`, `1 agent config`, `3 system prompts` |
| DO alive (WebSocket) | `101 Switching Protocols` |
| Chat endpoint | `200` — LLM responds via OpenRouter (`openai/gpt-oss-20b:free`) |
| CORS preflight | `204` with correct headers |
| Auth bypass (X-Dev-Tenant) | `403 Forbidden` — correctly blocked |
| Unauthenticated | `401 Authentication required` |
| TypeScript | Clean |
| Tests | 210 pass |

---

## Chat Endpoint — Fully Working

The full pipeline is operational:

```
Browser POST /api/talla/chat
  → Worker parses body + resolves auth
  → Worker calls DO via stub.fetch("https://talla-agent/chat")
  → TallaAgent.onRequest() matches /chat path
  → handleChat() builds system prompt from D1 data
  → chatCompletion() calls OpenRouter LLM
  → Response returned to browser
```

**Test:**
```bash
curl -X POST "https://talla-agent-staging.merqato-digital.workers.dev/api/talla/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","tenantId":"marina_terrace"}'
```

**Response:**
```json
{"content":"Hello! How may I assist you today?","model":"openai/gpt-oss-20b:free","usage":{"promptTokens":1888,"completionTokens":47,"totalTokens":1935}}
```

---

## What's Blocked

| Feature | Blocker |
|---------|---------|
| Computer | Requires `worker_loaders` binding → paid Cloudflare plan |
| Scheduled Workflows | Requires paid Workers plan |
| Auth-gated routes (tours, settings, requests) | Need `SUPABASE_ANON_KEY` secret — not stored locally |

---

## Next Steps

1. **Set `SUPABASE_ANON_KEY`** — requires `wrangler secret put SUPABASE_ANON_KEY --config wrangler.staging.jsonc` (interactive)
2. **Upgrade Cloudflare plan** to unlock Computer + Workflows in staging
3. **Run latency baseline** for chat endpoint
4. **Commit staging config** (see below)

---

## Files Added/Modified

- `worker/wrangler.staging.jsonc` — staging Worker config
- `STAGING-DEPLOYMENT-REPORT.md` — this report
