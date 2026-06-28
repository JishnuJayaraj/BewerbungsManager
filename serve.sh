#!/usr/bin/env bash
# JobCraft — single-port home server.
# Serves the whole app (UI + API) from FastAPI on one port, bound to the local
# network so other devices on your WiFi can use it.
#
# Usage:
#   ./serve.sh                 # build frontend + migrate + serve on 0.0.0.0:8000
#   ./serve.sh --no-build      # skip the frontend build (use the prebuilt frontend/dist).
#                              #   Use this on low-RAM boxes like a Raspberry Pi: build the
#                              #   frontend on a beefier machine and copy frontend/dist over.
#   PORT=8080 ./serve.sh ...   # use a different port (handy if 8000 is taken)
#
# Then on any device on the same WiFi, open:  http://<this-machine-ip>:<port>
# Find this machine's IP with:  hostname -I   (first address)
#
# Requires: uv (backend). npm is only needed when building (i.e. without --no-build).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8000}"
NO_BUILD=0
[[ "${1:-}" == "--no-build" ]] && NO_BUILD=1
export SERVE_FRONTEND=true

if [[ ! -f "$ROOT/.env" ]]; then
  echo "!! No .env found. Copy .env.example to .env and fill in HR4U_* and LLM_* keys." >&2
  exit 1
fi

if [[ "$NO_BUILD" == "1" ]]; then
  if [[ ! -f "$ROOT/frontend/dist/index.html" ]]; then
    echo "!! --no-build set but frontend/dist is missing." >&2
    echo "   Build it on another machine (cd frontend && npm run build) and copy dist/ here." >&2
    exit 1
  fi
  echo ">> Using prebuilt frontend/dist (skipping build)"
else
  echo ">> Building frontend"
  ( cd "$ROOT/frontend" && npm install && npm run build )
fi

echo ">> Preparing database"
( cd "$ROOT/backend" && uv sync && uv run alembic upgrade head )

echo
echo ">> Serving on http://0.0.0.0:${PORT}"
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -n "${ip:-}" ]] && echo ">> On your WiFi, open:  http://${ip}:${PORT}"
echo

( cd "$ROOT/backend" && uv run uvicorn app.main:app --host 0.0.0.0 --port "$PORT" )
