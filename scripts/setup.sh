#!/usr/bin/env bash
# Brings up the local dev environment (LocalStack + Redis + Jaeger, keys,
# .env, tables, and seed) to the point where only `npm run dev` is left.
# Idempotent: skips any step whose result already exists.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 1/5 RS256 keys"
if [ -f apps/api/keys/private.pem ] && [ -f apps/api/keys/public.pem ]; then
  echo "    already exist in apps/api/keys/ - skipping"
else
  npm run generate:keys --workspace=apps/api
fi

echo "==> 2/5 .env files"
if [ -f apps/api/.env ]; then
  echo "    apps/api/.env already exists - skipping"
else
  cp apps/api/.env.example apps/api/.env
  echo "    created apps/api/.env"
fi
if [ -f apps/web/.env ]; then
  echo "    apps/web/.env already exists - skipping"
else
  cp apps/web/.env.example apps/web/.env
  echo "    created apps/web/.env"
fi

echo "==> 3/5 Starting LocalStack + Redis + Jaeger"
docker compose up -d

echo "==> 4/5 Waiting for LocalStack and Redis to be ready"
for i in $(seq 1 30); do
  if curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "    LocalStack did not respond in time" >&2
    exit 1
  fi
  sleep 1
done
for i in $(seq 1 30); do
  if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "    Redis did not respond in time" >&2
    exit 1
  fi
  sleep 1
done
echo "    LocalStack and Redis ready"

echo "==> 5/5 Build shared packages + tables + seed"
npm run build --workspace=@swe-challenge-stone/common
npm run bootstrap:localstack --workspace=apps/api
npm run seed --workspace=apps/api

echo
echo "Done. Now run: npm run dev"
