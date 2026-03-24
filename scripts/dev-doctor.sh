#!/usr/bin/env bash

set -euo pipefail

report_command() {
  local name="$1"
  echo "${name}: $(command -v "${name}" || echo missing)"
}

report_env() {
  local name="$1"
  if [ -n "${!name:-}" ]; then
    echo "${name}: set"
  else
    echo "${name}: missing"
  fi
}

echo "== Agent Foundry dev doctor =="

report_command node
echo "node version: $(node -v 2>/dev/null || echo missing)"
report_command npm
echo "npm version: $(npm -v 2>/dev/null || echo missing)"
report_command docker
echo "docker context: $(docker context show 2>/dev/null || echo unavailable)"
report_command colima
report_command psql
report_command redis-cli

if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$node_major" -lt 20 ]; then
    echo "ERROR: Node 20+ is required."
    exit 1
  fi
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "docker engine: reachable"
  else
    echo "docker engine: not reachable"
    echo "hint: start Docker Desktop or Colima before running durable mode"
  fi
else
  echo "docker engine: unavailable"
fi

store_mode="${AGENT_FOUNDRY_STORE_MODE:-in-memory}"
echo "AGENT_FOUNDRY_STORE_MODE=${store_mode}"

if [ "${store_mode}" = "durable" ]; then
  report_env DATABASE_URL
  report_env REDIS_URL

  if [ -z "${DATABASE_URL:-}" ] || [ -z "${REDIS_URL:-}" ]; then
    echo "durable env guidance: copy apps/api/.env.example to apps/api/.env or export DATABASE_URL and REDIS_URL before starting the API"
  fi
else
  echo "durable env guidance: set AGENT_FOUNDRY_STORE_MODE=durable plus DATABASE_URL and REDIS_URL to test persistent storage"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql guidance: install the PostgreSQL client if you need to troubleshoot durable Postgres connectivity"
fi

if ! command -v redis-cli >/dev/null 2>&1; then
  echo "redis-cli guidance: install redis-cli if you need to inspect or debug durable memory storage"
fi

echo "Environment check complete."
