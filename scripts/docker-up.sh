#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  echo ""
}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI is missing"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker engine is not reachable"
  echo "If you are on this Intel Mac, start Colima first:"
  echo "  colima start --cpu 4 --memory 6 --disk 40"
  echo "If you are on another machine, start Docker Desktop."
  exit 1
fi

COMPOSE_CMD="$(compose_cmd)"
if [ -z "$COMPOSE_CMD" ]; then
  echo "docker compose plugin is missing"
  exit 1
fi

cd "$ROOT_DIR"
$COMPOSE_CMD -f infra/docker-compose.yml up --build
