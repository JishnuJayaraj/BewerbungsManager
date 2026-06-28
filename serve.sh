#!/usr/bin/env bash
# JobCraft — single-port home server.
# Builds the frontend once and serves the whole app (UI + API) from FastAPI on one
# port, bound to the local network so other devices on your WiFi can use it.
#
# Usage:
#   ./serve.sh            # build + migrate + seed (if empty) + serve on 0.0.0.0:8000
#   PORT=9000 ./serve.sh  # use a different port
#
# Then on any device on the same WiFi, open:  http://<this-machine-ip>:<port>
# Find this machine's IP with:  hostname -I   (first address)
#
# Requires: uv (backend) and npm (frontend). Copy .env.example -> .env and fill keys first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8000}"
export SERVE_FRONTEND=true

if [[ ! -f "$ROOT/.env" ]]; then
  echo "!! No .env found. Copy .env.example to .env and fill in HR4U_* and LLM_* keys." >&2
  exit 1
fi

echo ">> Building frontend"
( cd "$ROOT/frontend" && npm install && npm run build )

echo ">> Preparing database"
( cd "$ROOT/backend" && uv sync && uv run alembic upgrade head )

echo
echo ">> Serving on http://0.0.0.0:${PORT}"
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -n "${ip:-}" ]] && echo ">> On your WiFi, open:  http://${ip}:${PORT}"
echo

( cd "$ROOT/backend" && uv run uvicorn app.main:app --host 0.0.0.0 --port "$PORT" )
