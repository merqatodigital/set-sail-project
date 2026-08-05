# TALA and Hermes Workforce

Set Sail remains the Resort OS. TALA remains the guest-facing concierge with its existing voice, knowledge, lead capture, booking, tour, rental, reminder, payroll, payment, and operations tools. Hermes adds the private back-office workforce.

## Runtime boundary

- `tala-agent` is the guest-safe Hermes service. Its MCP allowlist contains only public resort facts, availability, tours, motorbikes, and pending booking requests.
- `hermes-workforce` is the owner/admin service. It has separate memory, credentials, sessions, skills, and back-office MCP tools.
- Admin uses `/api/hermes/status` and `/api/hermes/workforce` through the Set Sail server.
- The workforce route requires `HERMES_WORKFORCE_ACCESS_KEY` in addition to the private Hermes API key.
- Both services use the buyer's private `OPENROUTER_API_KEY`.
- Both services use the full pinned NousResearch Hermes runtime.
- Supabase service-role credentials never enter the browser.

## Workforce agents

- Hermes Supervisor delegates and combines specialist work.
- Financial Agent analyzes existing booking, payment, payroll, food, rental, and tour data.
- Lead Agent reviews and records qualified leads with source attribution.
- Email Agent reviews guest communication and drafts replies; sending is disabled until an email provider is connected and approved.
- Developer Agent can inspect the read-only mounted source. GitHub write access is disabled until a scoped token is configured.
- Operations Agent prepares daily briefings and pending internal tasks from existing resort data.

## Start

1. Copy `.env.hermes.example` to `.env.hermes` and configure the secrets on the private server.
2. Start both services with `docker compose --env-file .env.hermes -f docker-compose.hermes.yml up --build -d`.
3. Give the Set Sail server the `HERMES_TALA_*`, `HERMES_WORKFORCE_*`, and `HERMES_WORKFORCE_ACCESS_KEY` values.
4. Open Admin → Hermes Workforce and enter the workforce access key.
5. Verify connection status, then test Operations and Finance against existing resort data.

## Safety

Keep ports 8642 and 8643 on loopback or a private network. Use separate keys and data volumes for guest TALA and the workforce. Financial changes, external messages, reservation changes, code merges, deployments, credentials, and destructive actions remain human-controlled.

The current admin passkey is temporary. Replace it with Supabase Auth before exposing workforce access to production users.
