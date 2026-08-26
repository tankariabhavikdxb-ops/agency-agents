#!/usr/bin/env bash
# Start the Tally Bridge middleware (Linux / macOS)
set -e
cd "$(dirname "$0")"

if [ ! -x "venv/bin/python" ]; then
  echo "[ERROR] Virtual environment not found."
  echo "        Run ./setup.sh first to install the Tally Bridge."
  exit 1
fi

echo "Starting Tally Bridge ..."
echo "Open http://127.0.0.1:5000 in your browser  (Ctrl+C here to stop)"
echo
exec venv/bin/python server.py
