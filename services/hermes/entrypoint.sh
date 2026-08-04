#!/bin/sh
set -eu
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${API_SERVER_KEY:?API_SERVER_KEY is required}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
HERMES_HOME="${HERMES_HOME:-/data/hermes}"
HERMES_ROLE="${HERMES_ROLE:-workforce}"
export HERMES_HOME
mkdir -p "${HERMES_HOME}/skills"
cp -R /opt/tala/skills/. "${HERMES_HOME}/skills/"
cat > "${HERMES_HOME}/config.yaml" <<'YAML'
model:
  provider: openrouter
  default: ${HERMES_MODEL}
toolsets:
  - hermes-api-server
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: true
delegation:
  max_concurrent_children: 3
  max_spawn_depth: 1
  orchestrator_enabled: true
  subagent_auto_approve: false
approvals:
  mode: manual
mcp_servers:
  resort:
    command: python
    args: ["/opt/tala/mcp/resort_server.py"]
    env:
      SUPABASE_URL: "${SUPABASE_URL}"
      SUPABASE_SERVICE_ROLE_KEY: "${SUPABASE_SERVICE_ROLE_KEY}"
      RESORT_CMS_KEY: "${RESORT_CMS_KEY}"
YAML
if [ "${HERMES_ROLE}" = "tala" ]; then
  cat >> "${HERMES_HOME}/config.yaml" <<'YAML'
    tools:
      include:
        - get_resort_snapshot
        - check_room_availability
        - list_tours
        - check_motorbike
        - create_booking_request
YAML
  export API_SERVER_MODEL_NAME=tala
else
  cat >> "${HERMES_HOME}/config.yaml" <<'YAML'
    tools:
      include:
        - get_resort_snapshot
        - check_room_availability
        - list_tours
        - check_motorbike
        - create_booking_request
        - get_daily_operations
        - get_financial_snapshot
        - list_leads
        - create_lead
        - list_guest_messages
        - create_internal_task
YAML
  export API_SERVER_MODEL_NAME=hermes-workforce
fi
export API_SERVER_ENABLED=true
export API_SERVER_HOST=0.0.0.0
export API_SERVER_PORT=8642
exec hermes gateway
