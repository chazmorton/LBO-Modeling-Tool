#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/venv"

# ── 1. Virtual environment ────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

# ── 2. Dependencies ───────────────────────────────────────────────────────────
echo "Installing dependencies..."
pip install -q -r "$BACKEND/requirements.txt"

# ── 3. Start backend ──────────────────────────────────────────────────────────
echo "Starting backend on http://localhost:8000 ..."
uvicorn main:app --app-dir "$BACKEND" --reload &
BACKEND_PID=$!

# ── 4. Start frontend ─────────────────────────────────────────────────────────
echo "Starting frontend on http://localhost:8080 ..."
python3 -m http.server 8080 --directory "$FRONTEND" &
FRONTEND_PID=$!

# ── 5. Cleanup on exit ────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}
trap cleanup INT TERM

# ── 6. Open browser (brief delay lets servers bind first) ─────────────────────
sleep 1
open "http://localhost:8080" 2>/dev/null || true

echo ""
echo "App running — press Ctrl+C to stop."
wait
