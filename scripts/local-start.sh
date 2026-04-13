#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

for port in 3000 3001 3002; do
  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    kill -9 $pids || true
  fi
done

DB_URL="$(pnpm exec prisma dev -d | grep -Eo 'postgres://[^[:space:]]+' | head -n 1)"
if [[ -z "$DB_URL" ]]; then
  echo "Failed to start prisma dev"
  exit 1
fi

DATABASE_URL="$DB_URL" pnpm exec prisma db push --skip-generate

if [[ "$DB_URL" == *"?"* ]]; then
  RUNTIME_DB_URL="${DB_URL}&pgbouncer=true"
else
  RUNTIME_DB_URL="${DB_URL}?pgbouncer=true"
fi

echo "Local dev URL: http://localhost:${PORT:-3000}"
echo "Runtime DATABASE_URL: $RUNTIME_DB_URL"

DATABASE_URL="$RUNTIME_DB_URL" PORT="${PORT:-3000}" pnpm dev
