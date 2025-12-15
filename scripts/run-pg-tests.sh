#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="postgres"
COMPOSE_CMD="docker compose"
DB_URL_DEFAULT="postgres://postgres:postgres@localhost:5432/greenfield_service"

# Derive DB name for health checks from URL path (fallback to greenfield_service)
DB_NAME_FROM_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"
DB_NAME_FROM_URL="${DB_NAME_FROM_URL##*/}"
DB_NAME="${DB_NAME_FROM_URL:-greenfield_service}"

# Allow override, else default
export DATABASE_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"

cleanup() {
  echo "Stopping test stack..."
  $COMPOSE_CMD down --volumes --remove-orphans
}

trap cleanup EXIT

echo "Starting Postgres via docker compose..."
$COMPOSE_CMD up -d $SERVICE_NAME

echo "Waiting for Postgres to be healthy (db=$DB_NAME)..."
for i in {1..30}; do
  if $COMPOSE_CMD exec -T $SERVICE_NAME pg_isready -U postgres -d "$DB_NAME" >/dev/null 2>&1; then
    echo "Postgres is healthy"
    break
  fi
  if [[ "$i" == 30 ]]; then
    echo "Postgres did not become healthy in time" >&2
    exit 1
  fi
  sleep 1
done

echo "Running Postgres integration tests..."
pnpm test:pg

echo "Tests completed"
