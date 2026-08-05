# Hermes: owner-only back-office workforce on the existing backend

## What is actually broken

The Hermes admin page calls `/api/hermes/settings`, `/status`, `/verify`, `/workforce`. Those handlers call two database helpers, `hermes_runtime_config` and `hermes_secret_status`, and both read a table `private.hermes_secrets`.

That table does not exist. The `private` schema is empty. So every Hermes call fails and the page shows "Hermes settings database is not connected yet."

Confirmed as present and healthy: the owner row in `resort_members` (`marina_terrace` / owner), the `hermes_settings` row (provider `openrouter`, model `inclusionai/ling-3.0-flash:free`), CMS data, `tala_leads` (12 rows), `tala_tasks`, briefings, and the deployed `tala-chat` function.

## Approach

Move the Hermes runtime to a single backend function next to `tala-chat`, because the `OPENROUTER_API_KEY` secret lives in the backend function environment (the site's own server cannot read it). No Docker, no external Hermes URL, no access key, no key-entry fields in the browser.

Secrets stay entirely in the backend function environment: `OPENROUTER_API_KEY` and the service-role key. `hermes_settings` keeps only non-secret choices (provider, selected model). The stored-secret plumbing (`private.hermes_secrets`, `save_hermes_secrets`, `hermes_runtime_config`, `hermes_secret_status`) is retired instead of repaired, so no key ever passes through the browser or CMS data.

## Endpoints (one function, `hermes`)

| Endpoint | Purpose |
| --- | --- |
| `GET /hermes/settings` | Return provider, selected model, and which backend secrets are present (booleans only) |
| `PUT /hermes/settings` | Save selected OpenRouter model (free or paid) |
| `GET /hermes/models` | Live OpenRouter catalog, split free vs paid |
| `POST /hermes/verify` | Real live model test + real Supabase data read test; green checks only on success |
| `POST /hermes/run` | Run one agent (supervisor, finance, leads, email, developer, operations) against real resort data |
| `GET /hermes/handoffs` | List open TALA handoff rows from `tala_tasks` |
| `POST /hermes/handoff/:id` | Run the assigned agent on a handoff and write the result back |

Every endpoint requires an owner bearer token: verify the user, then require an `owner`/`admin` row in `resort_members`. No passkey, no access key.

## Agent data access

Read-only helpers inside the function, all through the existing tables: CMS payload (rooms, tours, motorbikes, bookings, payments, payroll, food, guest messages), `tala_leads`, `tala_tasks`, `tala_briefings`. Finance analyses, Leads qualifies and can write a lead, Operations can create a pending task, Email drafts only, Developer inspects only. No money movement, no sending, no pushes.

## TALA handoff

Guest TALA is unchanged. It already writes internal tasks; Hermes picks up `tala_tasks` rows in a `hermes` category, runs the right agent, and stores the answer as the task result for the owner to review. TALA never reads Hermes credentials.

## Admin UI cleanup (`src/admin/pages/HermesWorkforce.tsx`)

Remove: runtime URL field, access-key field, Ollama/Docker section, and the OpenRouter/Supabase/GitHub/Resend key inputs. Keep: provider + model picker (free/paid tabs), connection cards that only turn green after `POST /hermes/verify` passes live, the six agent consoles, and a handoff inbox.

Also delete the dead `/api/hermes/*` handlers and the external-Hermes proxy code from `src/server.ts`.

## Technical notes

- New function `supabase/functions/hermes/index.ts`; `verify_jwt = false` in `supabase/config.toml` (auth is enforced in-handler against `resort_members`).
- Migration: drop `hermes_runtime_config`, `hermes_secret_status`, `save_hermes_secrets`; keep `hermes_settings` and drop its secret-adjacent columns (`runtime_url`, `supabase_url`, `ollama_*`); add a `hermes_runs` table (agent, prompt, result, task_id, created_by) with RLS + GRANTs so only owners read it.
- Tests after implementing: each endpoint called live with a real owner token (401 without, 403 as non-owner), one real OpenRouter completion, one real CMS/leads/tasks read, one end-to-end handoff.
- Changes are committed to the linked GitHub main branch.

## What you may need to add once

- `OPENROUTER_API_KEY` is already saved in the backend secrets, so nothing is needed there.
- `GITHUB_TOKEN` and `RESEND_API_KEY` are optional; Developer write access and Email sending stay disabled until you add them. I will ask via the secure form only if you want those enabled.
- The SQL migration above is applied through the normal approval prompt; no manual SQL for you to paste.
