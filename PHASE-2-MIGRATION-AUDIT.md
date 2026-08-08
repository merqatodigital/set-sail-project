# PHASE 2 MIGRATION AUDIT — Set Sail → Cloudflare-Native Talla

**Date:** 2026-08-07
**Status:** AUDIT ONLY — No implementation
**Source:** Full repository inspection of `merqatodigital/set-sail-project`

---

## 1. EXECUTIVE SUMMARY

Set Sail / Marina Terrace is a working resort web application with a React frontend (TanStack Start/Vite), Supabase backend (PostgreSQL + Auth + Edge Functions + Storage), a Python Docker-based Hermes AI workforce, and an in-browser Talla AI concierge with voice.

**Key findings:**

- **27 database tables**, 7 SQL functions, 1 pg_cron job, 1 enum type, 0 triggers, 0 views
- **3 Edge Functions**: tala-chat (LangGraph agent), hermes (AI workforce), whatsapp-send (Twilio proxy)
- **1 Storage bucket**: `videos` (public, admin upload only)
- **0 Realtime subscriptions** — the app is entirely pull-based
- **22 tables accessed from frontend** via direct Supabase client calls
- **~45 files** contain Supabase imports or calls
- **Voice is fully client-side** (Kokoro WASM + Web Speech API) — unaffected by migration
- **No foreign keys** between operations tables — all relationships are application-level
- **JSONB blob pattern**: The `cms_data` table stores the entire site CMS payload as a single JSONB row
- **2 tables have no committed migration** (`hermes_settings`, `resort_members`) — created outside this repo

**Migration verdict:** The Supabase → Cloudflare migration is feasible. The application's data model is simple (mostly flat tables with text primary keys), RLS is straightforward (admin vs anon), and the Edge Functions are thin. The main complexity is the `cms_data` JSONB blob pattern and the Hermes Docker service.

---

## 2. CURRENT SUPABASE ARCHITECTURE

```
React SPA (Vite/TanStack Start)
├── Frontend (direct Supabase JS client)
│   ├── Auth: supabase.auth (email/password + OTP)
│   ├── Database: .from("table").select/insert/upsert/delete
│   ├── Storage: .from("videos").upload/getPublicUrl
│   └── RPC: .rpc("room_availability_conflicts", "generate_tala_briefing")
├── Supabase Edge Functions (Deno runtime)
│   ├── tala-chat: LangGraph agent (19 tools, OpenRouter)
│   ├── hermes: AI workforce (6 agents, owner-only)
│   └── whatsapp-send: Twilio proxy
├── Supabase PostgreSQL
│   ├── 27 tables (cms_data, 11 ops tables, 13 tala tables, auth-related)
│   ├── 7 SQL functions (has_role, room_availability_conflicts, generate_tala_briefing, 4 purge functions)
│   ├── 1 pg_cron job (daily briefing at 07:00 Manila)
│   ├── 1 enum (app_role: 'admin')
│   └── RLS on every table
├── Supabase Storage (1 bucket: videos)
└── Supabase Auth (email/password, OTP)
```

---

## 3. COMPLETE DEPENDENCY INVENTORY

### 3.1 Database Tables (27 total)

| # | Table | PK Type | Purpose | JSONB | Arrays | Guest-Safe? | Importance |
|---|---|---|---|---|---|---|---|
| 1 | `cms_data` | TEXT | Monolithic CMS blob (rooms, pricing, settings) | **value JSONB** | — | Auth read | CRITICAL |
| 2 | `bookings` | TEXT | Room/stay bookings | — | — | Anon INSERT | HIGH |
| 3 | `tours_catalog` | TEXT | Tour catalog | — | inclusions TEXT[] | Anon SELECT (active) | HIGH |
| 4 | `tour_bookings` | TEXT | Tour bookings | — | — | Admin only | HIGH |
| 5 | `guests` | TEXT | Guest registry | — | — | Admin only | HIGH |
| 6 | `staff_members` | TEXT | Staff registry | — | — | Admin only | MEDIUM |
| 7 | `shifts` | TEXT | Staff shifts | — | — | Admin only | MEDIUM |
| 8 | `pay_records` | TEXT | Payroll records | — | — | Admin only | MEDIUM |
| 9 | `payments` | TEXT | Revenue/expenses | — | — | Admin only | HIGH |
| 10 | `motorbikes` | TEXT | Motorbike fleet | — | — | Admin only | MEDIUM |
| 11 | `motorbike_rentals` | TEXT | Motorbike rental records | — | — | Admin only | MEDIUM |
| 12 | `inventory_items` | TEXT | Stock tracking | — | — | Admin only | MEDIUM |
| 13 | `user_roles` | UUID | Admin role assignments | — | — | Self read | CRITICAL |
| 14 | `tala_leads` | UUID | Captured guest leads | — | — | **Anon R/W** | MEDIUM |
| 15 | `tala_audit_log` | UUID | Conversation audit trail | — | tools_used TEXT[] | **Anon INSERT** | LOW |
| 16 | `tala_goals` | UUID | Business goals | — | — | **Anon R/W** | LOW |
| 17 | `tala_tasks` | UUID | Tasks/reminders/handoffs | — | — | **Anon R/W** | MEDIUM |
| 18 | `tala_briefings` | UUID | Daily briefings | highlights JSONB | — | **Anon R/W** | MEDIUM |
| 19 | `tala_wins` | UUID | Daily wins | — | — | **Anon R/W** | LOW |
| 20 | `tala_knowledge` | UUID | Knowledge base entries | — | — | Admin only | MEDIUM |
| 21 | `tala_guest_memory` | TEXT | Cross-session guest facts | — | — | **Anon R/W** | LOW |
| 22 | `tala_booking_requests` | UUID | Guest booking intents | — | — | Anon INSERT | HIGH |
| 23 | `tala_tour_requests` | UUID | Guest tour intents | — | — | Anon INSERT | HIGH |
| 24 | `tala_rental_requests` | UUID | Guest rental intents | — | — | Anon INSERT | HIGH |
| 25 | `tala_proactive_messages` | TEXT | Proactive outreach msgs | — | — | **Anon R/W** | LOW |
| 26 | `hermes_settings` | TEXT | Hermes AI config | last_verification JSONB | — | Admin only | LOW |
| 27 | `resort_members` | composite | Resort membership | — | — | Admin only | LOW |

Plus: `hermes_runs` (UUID PK, agent execution logs)

### 3.2 SQL Functions (7)

| Function | Language | SECURITY DEFINER | Purpose |
|---|---|---|---|
| `has_role(UUID, app_role)` | SQL | YES | Role check for RLS policies |
| `room_availability_conflicts(TEXT, TEXT)` | SQL | YES | Room overlap check |
| `generate_tala_briefing()` | PL/pgSQL | YES | Build morning briefing from operations data |
| `purge_old_briefings()` | PL/pgSQL | no | Delete briefings > 30 days |
| `purge_old_audit_log()` | PL/pgSQL | no | Delete audit entries > 30 days |
| `purge_old_proactive_messages()` | PL/pgSQL | no | Delete read proactive messages > 14 days |
| `hermes_runtime_config(TEXT)` | SQL | YES | Join settings + secrets for Hermes |

### 3.3 Scheduled Jobs (1)

| Job | Schedule | Function |
|---|---|---|
| `tala_daily_briefing` | `0 23 * * *` UTC (07:00 Manila) | `generate_tala_briefing()` |

### 3.4 Postgres-Specific Features (D1/SQLite incompatible)

| Feature | Tables/Functions | D1 Equivalent |
|---|---|---|
| `gen_random_uuid()` | 13 tables | `hex(randomblob(16))` or application-generated |
| `TIMESTAMPTZ` | Most tables | TEXT (ISO 8601 strings) |
| `NOW()` | Defaults | `datetime('now')` |
| `interval` arithmetic | Purge functions, briefing | Date math in application code |
| `TEXT[]` arrays | `tala_audit_log.tools_used`, `tours_catalog.inclusions` | JSON text or junction table |
| `NUMERIC` | Financial columns | REAL (sufficient for PHP amounts) |
| `::date` casts | `room_availability_conflicts` | String comparison (dates stored as TEXT) |
| `format()`, `to_char()` | Briefing function | String concatenation in app code |
| `AT TIME ZONE` | Briefing function | Timezone handling in app code |
| `to_jsonb()` | Briefing function | N/A (app code builds JSON) |
| `string_agg()` | Briefing function | Group concat in app code |
| `PL/pgSQL` | 4 functions | JavaScript in Worker or application code |
| `SECURITY DEFINER` | 4 functions | Worker-side authorization |
| `pg_cron` | 1 job | Cloudflare Workers scheduled() or Durable Object alarms |
| `REFERENCES auth.users(id)` | user_roles, hermes_runs | Cloudflare Auth or custom users table |
| `pgcrypto` extension | gen_random_uuid() | Application-level UUID generation |

---

## 4. RLS AND SECURITY AUDIT

### 4.1 Complete RLS Policy Inventory

**Pattern 1: Admin-only (12 tables)**
Tables: `guests`, `tour_bookings`, `staff_members`, `shifts`, `pay_records`, `payments`, `motorbikes`, `motorbike_rentals`, `inventory_items`, `tala_knowledge`, `bookings` (admin ops), `user_roles` (self+admin)

Policy: `USING (public.has_role(auth.uid(), 'admin'))` for SELECT/INSERT/UPDATE/DELETE

**Pattern 2: Anon-writable (8 tables)**
Tables: `tala_leads`, `tala_audit_log`, `tala_goals`, `tala_tasks`, `tala_briefings`, `tala_wins`, `tala_guest_memory`, `tala_proactive_messages`

Policy: Anon can INSERT + SELECT. Authenticated can ALL.

**Pattern 3: Guest request tables (3 tables)**
Tables: `tala_booking_requests`, `tala_tour_requests`, `tala_rental_requests`

Policy: Anon INSERT only (with status='pending'/'requested'). Authenticated SELECT + UPDATE.

**Pattern 4: Public read (1 table)**
Table: `tours_catalog`

Policy: Anon SELECT where `active = true`. Authenticated ALL.

**Pattern 5: CMS data**
Table: `cms_data`

Policy: Authenticated SELECT + ALL (simplified from earlier admin-gated version).

**Pattern 6: Resort membership (1 table)**
Table: `hermes_runs`

Policy: SELECT/INSERT where `EXISTS(SELECT 1 FROM resort_members WHERE resort_id = ... AND user_id = auth.uid() AND role IN ('owner', 'admin'))`.

**Pattern 7: Storage**
Bucket: `videos`

Policy: Authenticated INSERT/DELETE. Public SELECT.

### 4.2 Cloudflare Security Replacement

| Supabase Pattern | Cloudflare Replacement |
|---|---|
| `has_role(auth.uid(), 'admin')` | Worker middleware checks session/JWT → role lookup in D1 |
| Anon INSERT on request tables | Worker validates input, rate-limits, writes to D1 |
| `REFERENCES auth.users(id)` | Custom users table in D1 + Cloudflare Access or custom auth |
| RLS enforcement at DB level | Worker authorization layer between browser and D1 |
| `SECURITY DEFINER` functions | Worker-side business logic (tools) |
| Service role bypass | Worker-internal D1 access (no browser access) |

**Critical:** In the Cloudflare architecture, the browser NEVER accesses D1 directly. All database operations go through Worker APIs with authorization checks. This replaces RLS with application-level enforcement.

---

## 5. AUTHENTICATION AUDIT

### 5.1 Current Auth Flow

| Flow | Implementation | Complexity |
|---|---|---|
| Admin login | Email/password via Supabase Auth | Standard |
| Admin session | JWT in localStorage, auto-refresh | Standard |
| Admin role check | `user_roles` table + `has_role()` function | Simple |
| Admin route guard | Client-side `isAuthed` check in AdminApp.tsx | Simple |
| Server-side auth | Bearer token relay + JWT validation middleware | Standard |
| Hermes owner auth | OTP magic link via Supabase Auth | Standard |
| Hermes endpoint auth | Bearer token → `resort_members` check | Custom |
| Guest portal | No auth — phone+name in React state | Trivial |
| TALA widget | No auth — anonymous | Trivial |

### 5.2 Auth Replacement Requirements

For the Cloudflare architecture, auth must provide:

1. **Email/password login** for admin users
2. **JWT or session tokens** with automatic refresh
3. **Role resolution** (admin vs owner vs staff)
4. **Server-side token validation** in Worker middleware
5. **Client-side auth state** with change listener
6. **Magic link / OTP** for owner sign-in
7. **Multi-tenant resort membership** (for future Talla product)

**Options:**
- **Cloudflare Access** — zero-trust auth, but not suitable for admin login UI
- **Custom auth in D1** — email/password + JWT signing in Worker
- **Clerk / Auth.js / Lucia** — third-party auth that works with Workers
- **Keep Supabase Auth temporarily** — dual-system during migration

**Recommendation:** Keep Supabase Auth during migration phases. Only replace when the full D1 cutover happens. Auth is the highest-risk migration item.

---

## 6. STORAGE → R2 MAP

| Supabase | R2 Equivalent | Notes |
|---|---|---|
| `videos` bucket (public) | R2 bucket: `resort-assets` | Public read via custom domain or R2 public access |
| `site-videos/{timestamp}-{random}.{ext}` path | `/tenants/{id}/videos/{filename}` | Add tenant prefix for multi-tenant |
| `supabase.storage.from("videos").upload()` | Worker handles upload → R2 `put()` | Worker validates, then writes |
| `supabase.storage.from("videos").getPublicUrl()` | R2 public URL or presigned URL | R2 gives permanent public URLs |

**Migration concern:** Video URLs are embedded in the `cms_data` JSONB blob. After migration, old Supabase URLs must be rewritten to R2 URLs. A migration script should handle this.

**Only 1 bucket exists.** Storage migration is low complexity.

---

## 7. EDGE FUNCTIONS → CLOUDFLARE MAP

| Edge Function | Current | Target | Complexity |
|---|---|---|---|
| `tala-chat` | LangGraph agent in Deno | **TallaAgent Durable Object** (already scaffolded) | HIGH — rewrite LangGraph to AI SDK |
| `hermes` | Owner-only AI workforce in Deno | **Worker routes + TallaAgent methods** | MEDIUM — 8 endpoints to Worker routes |
| `whatsapp-send` | Twilio proxy in Deno | **Worker route** | LOW — direct port |

### 7.1 `tala-chat` → TallaAgent

Current: 1155-line LangGraph StateGraph with 19 tools, classification node, audit node, model fallback chain.

Target: `TallaAgent` Durable Object with:
- AI SDK `generateText()` + tool definitions
- `@callable()` methods for client RPC
- WebSocket for realtime chat
- Same 19 tools as AI SDK `tool()` definitions
- Model fallback chain in application code

### 7.2 `hermes` → Worker Routes

Current: 8 HTTP endpoints with owner auth.

Target: Worker fetch handler routes:
| Endpoint | Worker Route |
|---|---|
| `GET /settings` | `GET /api/hermes/settings` |
| `PUT /settings` | `PUT /api/hermes/settings` |
| `GET /models` | `GET /api/hermes/models` |
| `POST /verify` | `POST /api/hermes/verify` |
| `POST /run` | `POST /api/hermes/run` |
| `GET /handoffs` | `GET /api/hermes/handoffs` |
| `POST /handoff` | `POST /api/hermes/handoff` |
| `GET /runs` | `GET /api/hermes/runs` |

### 7.3 `whatsapp-send` → Worker Route

Current: Twilio API proxy with admin auth.

Target: `POST /api/whatsapp/send` Worker route.

---

## 8. REALTIME → DO/WEBSOCKET/WORKER MAP

**Current Realtime usage: NONE.**

The application is entirely pull-based:
- CMS loads on mount
- Admin pages fetch on mount
- TALA Edge Function reads per-request
- No live dashboards, no subscriptions, no realtime updates

**Cloudflare Realtime opportunities (not required for Phase 1-3):**
- TALA chat WebSocket (already part of Cloudflare Agent SDK)
- Live admin dashboard updates (optional enhancement)
- Live audit log streaming (optional enhancement)

**Recommendation:** Do not add Realtime unless a specific operational need arises. The pull-based architecture works for a single-resort application.

---

## 9. FRONTEND DEPENDENCY MAP

### 9.1 By Functional Area

| Area | Files | Tables | Priority |
|---|---|---|---|
| **Auth** | 4 files | user_roles | Keep Supabase Auth |
| **CMS** | 3 files | cms_data | HIGH — main data bottleneck |
| **Bookings** | 2 files | bookings, tala_booking_requests | HIGH |
| **Tours** | 2 files | tours_catalog, tour_bookings, tala_tour_requests | HIGH |
| **Rentals** | 2 files | motorbikes, motorbike_rentals, tala_rental_requests | MEDIUM |
| **Payments** | 1 file | payments | HIGH |
| **Staff** | 1 file | staff_members, shifts, pay_records | MEDIUM |
| **Inventory** | 1 file | inventory_items | MEDIUM |
| **Guests** | 1 file | guests | MEDIUM |
| **TALA Ops** | 3 files | tala_goals, tala_tasks, tala_briefings, tala_wins | LOW |
| **TALA Knowledge** | 2 files | tala_knowledge | MEDIUM |
| **TALA Proactive** | 1 file | tala_proactive_messages | LOW |
| **TALA Tools** | 2 files | tala_leads, tala_booking/tour/rental_requests, tala_guest_memory | HIGH |
| **Hermes** | 1 file | (Edge Function only) | HIGH |
| **WhatsApp** | 1 file | (Edge Function only) | MEDIUM |
| **Video** | 1 file | videos bucket | LOW |

### 9.2 Total Migration Surface

- **~45 files** contain Supabase imports
- **22 tables** accessed from frontend
- **2 RPC calls** (room_availability_conflicts, generate_tala_briefing)
- **1 Storage bucket** (videos)
- **3 Edge Functions** (tala-chat, hermes, whatsapp-send)

### 9.3 What Should Become Worker API Calls

**Phase 3 priority (operations CRUD):**
- `opsRepo.ts` — 39 functions over 11 tables → Worker routes
- `storage.ts` — CMS load/save → Worker route
- `talaTools.ts` — confirmation/lead/memory tools → Worker routes or Agent tools

**Phase 4 priority (TALA internals):**
- `talaOps.ts` — goals/tasks/briefings/wins → Worker routes
- `talaKnowledge.ts` — knowledge CRUD → Worker route
- `talaProactive.ts` — proactive messages → Worker route
- `talaGraph.ts` — audit log writes → Agent internal

**Phase 5 priority (infrastructure):**
- Auth — keep Supabase Auth temporarily
- WhatsApp — direct Worker port
- Video storage — R2 migration

---

## 10. RECOMMENDED D1 TENANT ARCHITECTURE

### 10.1 Option A: Shared Multi-Tenant D1

One D1 database. Every table gets a `tenant_id TEXT` column.

**Pros:**
- Simple provisioning (no new database per resort)
- Cross-resort analytics trivial
- Single schema migration path
- Lower operational complexity
- Cloudflare D1 supports up to 10GB per database — sufficient for hundreds of resorts

**Cons:**
- Tenant isolation requires careful WHERE clauses on every query
- Data export per-tenant requires filtering
- Customer deletion requires cascading deletes with tenant filter
- A bug in one tenant's code could affect another

### 10.2 Option B: Per-Tenant D1

One D1 database per resort. Identical schemas.

**Pros:**
- Perfect tenant isolation (separate databases)
- Data export = dump entire database
- Customer deletion = delete database
- No cross-tenant query bugs possible

**Cons:**
- Provisioning complexity (create D1 + run migrations per resort)
- Schema migration must roll out to all databases
- Cross-resort analytics requires querying all databases
- D1 has a database limit per account (currently 50,000)
- More expensive at scale

### 10.3 Recommendation: OPTION A (Shared Multi-Tenant D1)

**Reasoning:**
1. Talla is a B2B product targeting small-to-medium resorts. Initial scale is tens of resorts, not thousands.
2. D1's 10GB limit is generous for resort data (typical resort: <100MB of business data).
3. The existing schema already has `resort_id` on `hermes_settings` and `hermes_runs` — the multi-tenant pattern is partially established.
4. Shared database is simpler to operate, migrate, and debug.
5. Tenant isolation can be enforced at the Worker middleware level (every API call includes resort context, every D1 query includes `WHERE tenant_id = ?`).
6. If a single resort outgrows the shared DB, it can be split later (data export → new D1).

**Implementation pattern:**
```
Every table gets: tenant_id TEXT NOT NULL DEFAULT 'marina_terrace'
Every query gets: WHERE tenant_id = ? (enforced by Worker middleware)
Worker middleware extracts tenant from: session/JWT → resort membership → tenant_id
```

---

## 11. D1 MIGRATION MAP

### 11.1 Table-by-Table Classification

| Table | D1 Migration | PG Compatibility Issues | Notes |
|---|---|---|---|
| `cms_data` | D1 | JSONB → TEXT (store as JSON string) | Single-row pattern; `value` column stores full CMS JSON |
| `bookings` | D1 | TEXT PK, NUMERIC → REAL | No PG-specific features |
| `tours_catalog` | D1 | TEXT[] `inclusions` → JSON text | Store as JSON array string |
| `tour_bookings` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `guests` | D1 | TEXT PK | Clean migration |
| `staff_members` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `shifts` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `pay_records` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `payments` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `motorbikes` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `motorbike_rentals` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `inventory_items` | D1 | TEXT PK, NUMERIC → REAL | Clean migration |
| `user_roles` | D1 | UUID PK → TEXT, FK to auth.users → custom auth | Needs auth replacement |
| `tala_leads` | D1 | UUID PK → TEXT (app-generated) | Clean migration |
| `tala_audit_log` | D1 | UUID PK → TEXT, TEXT[] `tools_used` → JSON text | Store as JSON array |
| `tala_goals` | D1 | UUID PK → TEXT | Clean migration |
| `tala_tasks` | D1 | UUID PK → TEXT | Clean migration |
| `tala_briefings` | D1 | UUID PK → TEXT, JSONB `highlights` → TEXT | Store as JSON string |
| `tala_wins` | D1 | UUID PK → TEXT | Clean migration |
| `tala_knowledge` | D1 | UUID PK → TEXT | Clean migration |
| `tala_guest_memory` | D1 | TEXT PK | Clean migration |
| `tala_booking_requests` | D1 | UUID PK → TEXT | Clean migration |
| `tala_tour_requests` | D1 | UUID PK → TEXT | Clean migration |
| `tala_rental_requests` | D1 | UUID PK → TEXT | Clean migration |
| `tala_proactive_messages` | D1 | TEXT PK | Clean migration |
| `hermes_settings` | D1 | TEXT PK, JSONB → TEXT | Clean migration |
| `hermes_runs` | D1 | UUID PK → TEXT, FK to auth.users → custom | Needs auth replacement |
| `resort_members` | D1 | Composite PK, FK to auth.users → custom | Needs auth replacement |

### 11.2 SQL Functions → Application Code

| Function | D1 Replacement |
|---|---|
| `has_role()` | Worker middleware role check (query D1 `user_roles`) |
| `room_availability_conflicts()` | Worker tool: query `bookings` with overlap logic |
| `generate_tala_briefing()` | Worker tool: query operations tables, build briefing JSON |
| `purge_old_*()` | Cloudflare Workers cron or Durable Object alarm |
| `hermes_runtime_config()` | Worker reads D1 settings + Worker secrets |

### 11.3 PostgreSQL → SQLite Compatibility

| PG Feature | SQLite/D1 Equivalent |
|---|---|
| `gen_random_uuid()` | `lower(hex(randomblob(16)))` or app-generated UUID |
| `TIMESTAMPTZ` | TEXT (ISO 8601 with timezone) |
| `NOW()` | `datetime('now')` |
| `NUMERIC` | REAL (sufficient for PHP amounts < 2^53) |
| `TEXT[]` arrays | TEXT column storing JSON array |
| `JSONB` | TEXT column storing JSON string (D1 has JSON functions) |
| `interval` arithmetic | Application code date math |
| `format()`, `to_char()` | Application code string formatting |
| `AT TIME ZONE` | Application code timezone handling |
| `string_agg()` | `GROUP_CONCAT()` or application code |
| `SECURITY DEFINER` | Worker-side authorization |
| `PL/pgSQL` | JavaScript in Worker |
| `pg_cron` | Workers cron trigger or DO alarms |
| `REFERENCES auth.users(id)` | Custom users table FK |
| `EXISTS` subqueries in RLS | Worker-side authorization logic |

---

## 12. R2 ARCHITECTURE

```
r2://resort-assets/
├── {tenant_id}/
│   ├── videos/
│   │   └── site-videos/
│   │       └── {timestamp}-{random}.{ext}
│   ├── images/
│   │   ├── rooms/
│   │   ├── gallery/
│   │   └── blog/
│   ├── documents/
│   │   ├── menus/
│   │   └── reports/
│   └── generated/
│       ├── briefings/
│       └── reports/
```

**Public assets:** Videos, room images, gallery images, blog images — served via R2 public access or custom domain.

**Private assets:** Generated reports, internal documents — accessed via Worker-signed URLs.

**Migration note:** Current `cms_data` JSONB contains image URLs pointing to external CDN or Supabase Storage. These need URL rewriting during migration.

---

## 13. WORKFLOWS OPPORTUNITIES

| Workflow | Trigger | Steps | Value |
|---|---|---|---|
| **Daily owner briefing** | Cron (07:00 Manila) | Query operations → build briefing → store in D1 → optionally send WhatsApp | HIGH — replaces pg_cron |
| **Guest arrival prep** | Cron (daily 06:00) | Check today's arrivals → prepare room status → notify staff | MEDIUM |
| **Departure workflow** | Cron (daily 10:00) | Check today's departures → settle bills → update room status | MEDIUM |
| **Inventory restock check** | Cron (daily 08:00) | Check low stock → create tasks → notify owner | MEDIUM |
| **Maintenance escalation** | On task creation | If maintenance task unaddressed > 24h → escalate to owner | LOW |
| **Lead follow-up** | Cron (daily 09:00) | Check unconverted leads → create follow-up tasks | LOW |

**Do NOT convert to Workflows:**
- Simple CRUD operations (bookings, tours, rentals)
- Single API calls (room availability check)
- TALA chat messages (use Agent, not Workflow)

---

## 14. COMPUTER BOUNDARY

### Should live in Computer (eventually):

| Data | Why |
|---|---|
| Daily operational briefings (generated) | Working documents, not transactional |
| Generated reports (financial, occupancy) | Computed artifacts |
| Maintenance history/notes | Operational working files |
| Owner analysis requests | Temporary analysis workspace |
| TALA working notes | Agent's operational scratchpad |
| Document generation (PDFs, exports) | Controlled execution |
| Scheduled operational files | Daily/weekly file generation |

### Should NEVER live in Computer:

| Data | Why |
|---|---|
| Bookings (authoritative) | Transactional — D1 is source of truth |
| Payments (authoritative) | Financial — D1 is source of truth |
| User authentication | Security — Worker + D1 |
| Room inventory (source of truth) | Transactional — D1 |
| Guest requests | Transactional — D1 |
| API credentials | Security — Worker secrets |

---

## 15. SECRET MANAGEMENT

### 15.1 Current Secrets (10)

| Secret | Used By | Phase 3 Location |
|---|---|---|
| `OPENROUTER_API_KEY` | Edge fn, Hermes, Worker | Worker secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge fn, Hermes MCP, Worker | Worker secret (temporary) |
| `TWILIO_ACCOUNT_SID` | whatsapp-send | Worker secret |
| `TWILIO_AUTH_TOKEN` | whatsapp-send | Worker secret |
| `HERMES_TALA_API_KEY` | Inter-service auth | Remove (single Worker) |
| `HERMES_WORKFORCE_API_KEY` | Inter-service auth | Remove (single Worker) |
| `HERMES_WORKFORCE_ACCESS_KEY` | Admin session auth | Replace with auth system |
| `GITHUB_TOKEN` | Developer agent | Worker secret |
| `RESEND_API_KEY` | Email agent | Worker secret |
| `SUPABASE_PUBLISHABLE_KEY` | Client-side Supabase | Keep during migration |

### 15.2 Future Multi-Tenant Secrets

For the Talla product (multi-resort), each resort owner needs:
- **OpenRouter BYO key** — stored encrypted in D1 `resort_settings` table, decrypted by Worker
- **WhatsApp credentials** — optional per-resort, stored in D1
- **Other API keys** — optional per-resort

**Pattern:**
```
D1 table: resort_secrets (tenant_id, secret_name, encrypted_value)
Worker decrypts at runtime using a master key from Worker secrets
```

---

## 16. OLLAMA REALITY CHECK

### 16.1 Current State

- `hermes_settings` table has `ollama_base_url` and `ollama_model` columns
- Hermes Docker service has `OLLAMA_BASE_URL` and `OLLAMA_MODEL` env vars
- Admin UI (`HermesWorkforce.tsx`) has Ollama as a provider option
- **Actual functionality: unclear.** The Docker service connects to Ollama via HTTP, but there's no evidence it's been tested or used in production.

### 16.2 Cloudflare Limitation

A Cloudflare Worker **cannot** reach `localhost` on a resort owner's PC. Ollama runs locally and is not internet-accessible by default.

### 16.3 Connector Requirements

To use Ollama with Cloudflare Talla:
1. **Tunnel** — owner runs `cloudflared tunnel` to expose Ollama
2. **Or local agent** — owner runs a lightweight local agent that polls the Worker for tasks
3. **Or ngrok/similar** — temporary URL exposure (not recommended for production)

**Recommendation:** Ollama support should be a documented optional configuration, not a core dependency. The primary path is OpenRouter BYO key.

---

## 17. DATA MIGRATION STRATEGY

### 17.1 Zero-Data-Loss Migration Sequence

```
Phase A: Export
├── Export all 27 tables from Supabase (pg_dump or Supabase API)
├── Export cms_data JSONB (full CMS payload)
├── Export videos bucket files
└── Export auth users (if replacing auth)

Phase B: Transform
├── Convert UUID PKs to TEXT (app-generated)
├── Convert TEXT[] arrays to JSON text
├── Convert JSONB columns to TEXT (JSON string)
├── Convert NUMERIC to REAL
├── Add tenant_id column to every table
├── Generate D1 CREATE TABLE statements
└── Convert PL/pgSQL functions to JavaScript

Phase C: Load
├── Create D1 database
├── Run D1 migrations
├── INSERT all rows (batch by table)
├── Upload videos to R2
└── Update cms_data image URLs to R2 paths

Phase D: Validate
├── Record counts match (Supabase vs D1)
├── Financial totals match (payments, pay_records)
├── Booking status counts match
├── Inventory quantities match
├── Guest count matches
├── CMS content renders correctly
├── Video URLs resolve
└── TALA tools return correct data

Phase E: Cutover
├── Deploy Worker with D1 backend
├── Feature flag: route requests to Supabase or D1
├── Monitor error rates
├── Toggle flag to D1
└── Keep Supabase read-only for rollback

Phase F: Cleanup
├── Keep Supabase for 30 days (read-only backup)
├── Remove Supabase Edge Functions
├── Remove Supabase client from frontend
└── Decommission Supabase project
```

### 17.2 Validation Checklist

| Check | Method |
|---|---|
| Record counts | `SELECT COUNT(*) FROM every_table` (both systems) |
| Financial totals | `SUM(amount) FROM payments WHERE direction='in'` (both) |
| Booking status counts | `SELECT status, COUNT(*) FROM bookings GROUP BY status` |
| Inventory quantities | `SELECT SUM(quantity) FROM inventory_items` |
| Guest count | `SELECT COUNT(*) FROM guests` |
| CMS content | Render homepage, compare key fields |
| Video URLs | HTTP HEAD each URL (both old and new) |
| TALA responses | Send test queries, compare tool results |

---

## 18. CUTOVER SEQUENCE

### Recommended Order (by dependency and risk)

| Phase | What | Risk | Dependencies |
|---|---|---|---|
| **3A** | Operations CRUD (11 tables) via Worker API | LOW | D1 schema, Worker routes |
| **3B** | CMS load/save via Worker | LOW | D1, R2 for images |
| **3C** | TALA confirmation tools via Worker | MEDIUM | Operations CRUD working |
| **3D** | WhatsApp via Worker | LOW | Twilio credentials |
| **4A** | TALA agent (replace Edge Function) | HIGH | AI SDK, OpenRouter, all tools |
| **4B** | Hermes (replace Edge Function + Docker) | MEDIUM | Worker routes, Agent methods |
| **5A** | Auth replacement (if desired) | HIGH | Custom auth or third-party |
| **5B** | Video storage → R2 | LOW | R2 bucket, URL rewriting |
| **6** | Computer integration | LOW | Feature-flagged, optional |

**Each phase runs in parallel with the existing Supabase backend.** The feature flag allows instant rollback.

---

## 19. FINAL KEEP / MIGRATE / REPLACE / REMOVE MATRIX

| Component | Phase 1-2 | Final Fate |
|---|---|---|
| **Lovable** (platform) | KEEP | Eventually unnecessary — deploy via Wrangler directly |
| **Supabase Database** | KEEP | MIGRATE to D1 (Phase 3-5) |
| **Supabase Auth** | KEEP | MIGRATE to custom auth or third-party (Phase 5) |
| **Supabase Storage** | KEEP | MIGRATE to R2 (Phase 5) |
| **Supabase Edge Functions** | KEEP | REPLACE with Worker routes + TallaAgent |
| **Supabase Realtime** | KEEP (unused) | REMOVE — no realtime currently used |
| **Hermes Docker** | KEEP | REMOVE — replaced by Worker + Agent |
| **LangGraph** | KEEP (in Edge Fn) | REPLACE with AI SDK in TallaAgent |
| **Python/MCP** | KEEP (in Docker) | REMOVE — replaced by Worker tools |
| **Client-side Talla loop** | KEEP | REPLACE with Agent RPC + tools |
| **Talla voice** | KEEP | UNCHANGED — fully client-side |
| **React UI** | KEEP | UNCHANGED |
| **Existing admin** | KEEP | UNCHANGED (API calls change, UI stays) |
| **OpenRouter** | KEEP | KEEP — BYO key, same API |
| **Ollama** | KEEP (if working) | OPTIONAL — requires tunnel/connector |
| **Existing React UI** | KEEP | UNCHANGED |
| **Existing admin** | KEEP | UNCHANGED |

---

## 20. RISKS AND BLOCKERS

| Risk | Severity | Mitigation |
|---|---|---|
| `cms_data` JSONB blob pattern | HIGH | Migrate to normalized D1 tables OR keep as JSON text in D1 |
| Auth replacement complexity | HIGH | Keep Supabase Auth until Phase 5 |
| LangGraph → AI SDK rewrite | MEDIUM | TallaAgent tools are simpler than LangGraph StateGraph |
| pg_cron → Workers cron | LOW | Direct mapping, well-documented |
| TEXT[] arrays → JSON | LOW | Store as JSON text, parse in application code |
| UUID generation in D1 | LOW | Application-level UUID (crypto.randomUUID()) |
| Foreign key behavior differences | LOW | Application-level enforcement (already the pattern) |
| `hermes_settings` / `resort_members` missing migrations | LOW | Create D1 migrations from types.ts definitions |
| TALA anon-writable tables (security) | MEDIUM | Worker validates all inputs, rate-limits |
| Multi-tenant data isolation | MEDIUM | Enforce `tenant_id` in Worker middleware + every query |
| Ollama connectivity | LOW | Document as optional, not core |
| Computer preview instability | LOW | Feature-flagged, never in critical path |

---

## 21. ESTIMATED IMPLEMENTATION PHASES

| Phase | Scope | Effort | Dependencies |
|---|---|---|---|
| **Phase 3** | D1 schema + Worker CRUD routes + frontend migration (11 ops tables + CMS) | 2-3 weeks | D1 database, Worker scaffold |
| **Phase 4** | TallaAgent tools + chat integration + Hermes replacement | 2-3 weeks | Phase 3 complete |
| **Phase 5** | Auth migration + R2 storage + WhatsApp Worker | 1-2 weeks | Auth decision |
| **Phase 6** | Computer integration (feature-flagged) | 1 week | Computer API stable |
| **Phase 7** | Supabase decommission + cleanup | 1 week | All phases verified |

**Total estimated: 7-10 weeks**

---

## 22. EXACT RECOMMENDATION FOR PHASE 3

**Phase 3 should implement:**

1. **D1 schema** — CREATE TABLE statements for all 27 tables, adapted for SQLite
2. **Worker CRUD routes** — Replace `opsRepo.ts` Supabase calls with Worker API endpoints:
   - `GET/PUT/DELETE /api/guests`
   - `GET/PUT/DELETE /api/bookings`
   - `GET/PUT/DELETE /api/tours`
   - `GET/PUT/DELETE /api/tour-bookings`
   - `GET/PUT/DELETE /api/staff`
   - `GET/PUT/DELETE /api/shifts`
   - `GET/PUT/DELETE /api/pay-records`
   - `GET/PUT/DELETE /api/payments`
   - `GET/PUT/DELETE /api/motorbikes`
   - `GET/PUT/DELETE /api/motorbike-rentals`
   - `GET/PUT/DELETE /api/inventory`
   - `POST /api/inventory/bulk`
   - `GET /api/operations/snapshot` (replaces `loadOperationsSnapshot`)
   - `POST /api/room-availability` (replaces RPC)
3. **CMS Worker route** — `GET/PUT /api/cms` replacing `storage.ts` Supabase calls
4. **Authorization middleware** — Role-based access on every route
5. **Feature flag** — Toggle between Supabase and D1 backends
6. **Data migration script** — Export from Supabase, transform, load to D1

**DO NOT implement in Phase 3:**
- Auth replacement
- TallaAgent tools (Phase 4)
- Hermes replacement (Phase 4)
- R2 storage (Phase 5)
- Computer integration (Phase 6)

**Verification for Phase 3 completion:**
- All admin CRUD pages work against D1
- CMS loads/saves correctly
- Room availability check works
- No Supabase client calls remain in `opsRepo.ts` or `storage.ts`
- Feature flag allows instant rollback to Supabase
- All existing tests pass

---

**END OF PHASE 2 MIGRATION AUDIT**

**STOP — Do not implement Phase 3 until this audit is reviewed.**
