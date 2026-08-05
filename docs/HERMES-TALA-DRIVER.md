# TALA and Hermes Workforce

Set Sail remains the Resort OS. TALA remains the guest-facing concierge with its existing voice, knowledge, lead capture, booking, tour, rental, reminder, payroll, payment, and operations tools. Hermes adds the private back-office workforce.

## Runtime boundary

- `tala-agent` is the guest-safe Hermes service. Its MCP allowlist contains only public resort facts, availability, tours, motorbikes, and pending booking requests.
- `hermes-workforce` is the owner/admin service. It has separate memory, credentials, sessions, skills, and back-office MCP tools.
- The workforce container includes an authenticated setup manager on port 8650. It writes secrets only to the private Hermes volume and restarts the real gateway after configuration.
- Admin connects directly to the resort's HTTPS Hermes address using a server access key kept only in the browser session.
- The owner enters OpenRouter, Supabase, GitHub, and email settings inside Admin → Hermes Workforce → Settings. The OpenRouter list is loaded live and separates free and paid models.
- The owner can switch the same Hermes runtime to Ollama and sync models installed on a Windows/macOS host through `host.docker.internal:11434`.
- Caddy supplies HTTPS for the workforce manager at `HERMES_DOMAIN`.
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

1. Point a DNS name such as `hermes.yourresort.com` to the Docker server.
2. Copy `.env.hermes.example` to `.env.hermes`. Set only `HERMES_DOMAIN`, `HERMES_TALA_API_KEY`, and `HERMES_WORKFORCE_API_KEY`; provider and resort connections can remain blank.
3. Start the services with `docker compose --env-file .env.hermes -f docker-compose.hermes.yml up --build -d`.
4. Open Admin → Hermes Workforce. Enter `https://<HERMES_DOMAIN>` and the `HERMES_WORKFORCE_API_KEY` value.
5. Open Settings, enter the resort's OpenRouter, Supabase, GitHub, and email connections, then select **Save and start Hermes**.
6. Verify the five connection cards, then run the Operations and Finance agents against Marina Terrace data.

## Safety

Keep ports 8642 and 8643 on loopback. Only Caddy ports 80 and 443 are public. Use separate keys and data volumes for guest TALA and the workforce. Financial changes, external messages, reservation changes, code merges, deployments, credentials, and destructive actions remain human-controlled.

The current admin passkey is temporary. Replace it with Supabase Auth before exposing workforce access to production users.
