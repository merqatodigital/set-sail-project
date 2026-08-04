#!/bin/sh
set -eu
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${API_SERVER_KEY:?API_SERVER_KEY is required}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
HERMES_HOME="${HERMES_HOME:-/data/hermes}"
export HERMES_HOME
mkdir -p "${HERMES_HOME}/skills/resort-operations"
cp -R /opt/tala/skills/resort-operations/. "${HERMES_HOME}/skills/resort-operations/"
cat > "${HERMES_HOME}/config.yaml" <<'YAML'
model:
  provider: openrouter
  default: ${HERMES_MODEL}
toolsets:
  - hermes-api-server
mcp_servers:
  resort:
    command: python
    args: ["/opt/tala/mcp/resort_server.py"]
    env:
      SUPABASE_URL: "${SUPABASE_URL}"
      SUPABASE_SERVICE_ROLE_KEY: "${SUPABASE_SERVICE_ROLE_KEY}"
      RESORT_CMS_KEY: "${RESORT_CMS_KEY}"
    tools:
      include:
        - get_resort_snapshot
        - check_room_availability
        - list_tours
        - create_booking_request
YAML
export API_SERVER_ENABLED=true
export API_SERVER_HOST=0.0.0.0
export API_SERVER_PORT=8642
export API_SERVER_MODEL_NAME=tala
exec hermes gateway
