# Hermes is the TALA driver

The complete NousResearch Hermes Agent runtime is TALA's private backend. The React application is the resort interface and does not run an independent LLM agent.

## Runtime boundary

- Set Sail renders the website, guest portal, staff experience, and admin.
- The browser calls only /api/tala/chat.
- The Set Sail server authenticates to Hermes with HERMES_API_KEY.
- Hermes owns model routing, memory, skills, schedules, approvals, and tools.
- The buyer's OPENROUTER_API_KEY exists only inside the Hermes service.
- Hermes reaches resort data only through allowlisted resort MCP tools.
- Supabase service-role credentials never enter the browser.
- There is no browser OpenRouter or LangGraph fallback.

## Start

1. Copy .env.hermes.example to .env.hermes and add secrets.
2. Run: docker compose --env-file .env.hermes -f docker-compose.hermes.yml up --build -d
3. Give the Set Sail server the same HERMES_API_KEY and a reachable HERMES_API_URL.
4. Verify the private Hermes /health endpoint.
5. Test the TALA widget through /api/tala/chat.

## Hermes source

The image clones the full upstream Hermes repository into /opt/hermes-agent at a pinned reviewed commit. TALA's owned resort skill and MCP bridge live in services/hermes. Update HERMES_COMMIT only after review and resort acceptance testing.

## Production

Keep port 8642 on loopback or a private network. Use separate secrets and Hermes data volumes for every resort. Require approval for refunds, cancellations, discounts, and destructive actions. Replace temporary browser passkeys and phone-only guest login with Supabase Auth before launch.
