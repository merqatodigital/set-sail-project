#!/bin/sh
set -eu
: "${API_SERVER_KEY:?API_SERVER_KEY is required}"
HERMES_HOME="${HERMES_HOME:-/data/hermes}"
HERMES_ROLE="${HERMES_ROLE:-workforce}"
export HERMES_HOME
mkdir -p "${HERMES_HOME}/skills"
cp -R /opt/tala/skills/. "${HERMES_HOME}/skills/"
export HERMES_ROLE
export HERMES_MANAGER_KEY="${HERMES_MANAGER_KEY:-${API_SERVER_KEY}}"
exec python /opt/tala/manager.py
