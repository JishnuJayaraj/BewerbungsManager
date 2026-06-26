#!/usr/bin/env bash
# JobCraft — top-to-bottom dev runner (Task 17).
# Prepares the backend DB (+ optional demo seed) and runs backend + frontend together.
#
# Usage:
#   ./run.sh            # migrate, seed demo data, start backend + frontend
#   ./run.sh --no-seed  # skip demo seed
#   SEED=0 ./run.sh     # same as --no-seed
#
# Requires: uv (backend), npm (frontend). Copy .env.example -> .env first and fill keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED="${SEED:-1}"
[[ "${1:-}" == "--no-seed" ]] && SEED=0

if [[ ! -f "$ROOT/.env" ]]; then
  echo "!! No .env found. Copy .env.example to .env and fill in HR4U_* and LLM_* keys." >&2
  exit 1
fi

echo ">> Backend: syncing deps + applying migrations"
( cd "$ROOT/backend" && uv sync && uv run alembic upgrade head )

if [[ "$SEED" == "1" ]]; then
  echo ">> Backend: seeding demo data (idempotent)"
  ( cd "$ROOT/backend" && uv run python -m app.seed )
fi

echo ">> Frontend: installing deps"
( cd "$ROOT/frontend" && npm install )

# Start both; kill the group on exit.
pids=()
cleanup() { trap - INT TERM EXIT; kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup INT TERM EXIT

echo ">> Starting backend on http://localhost:8000"
( cd "$ROOT/backend" && uv run uvicorn app.main:app --reload --port 8000 ) &
pids+=($!)

echo ">> Starting frontend on http://localhost:5173 (proxies /api -> backend)"
( cd "$ROOT/frontend" && npm run dev ) &
pids+=($!)

wait
