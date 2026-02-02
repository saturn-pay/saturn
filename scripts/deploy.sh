#!/usr/bin/env bash
set -euo pipefail

# Saturn deployment script
# Usage: ./scripts/deploy.sh [--migrate] [--seed]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

RUN_MIGRATE=false
RUN_SEED=false

for arg in "$@"; do
  case "$arg" in
    --migrate) RUN_MIGRATE=true ;;
    --seed)    RUN_SEED=true ;;
    *)         echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

echo "==> Building containers..."
docker compose -f docker-compose.prod.yml build

echo "==> Starting database..."
docker compose -f docker-compose.prod.yml up -d postgres
sleep 3

if [ "$RUN_MIGRATE" = true ]; then
  echo "==> Running database migrations..."
  docker compose -f docker-compose.prod.yml run --rm saturn \
    sh -c "for f in drizzle/*.sql; do echo \"Running \$f\"; PGPASSWORD=\$POSTGRES_PASSWORD psql -h postgres -U \${POSTGRES_USER:-saturn} -d \${POSTGRES_DB:-saturn} -f \"\$f\" 2>&1 || true; done"
fi

if [ "$RUN_SEED" = true ]; then
  echo "==> Seeding database..."
  docker compose -f docker-compose.prod.yml run --rm saturn node dist/db/seed.js
fi

echo "==> Starting Saturn..."
docker compose -f docker-compose.prod.yml up -d

echo "==> Waiting for health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:${PORT:-3000}/health > /dev/null 2>&1; then
    echo "==> Saturn is healthy!"
    exit 0
  fi
  sleep 1
done

echo "==> WARNING: Health check did not pass within 30s"
docker compose -f docker-compose.prod.yml logs saturn --tail 50
exit 1
