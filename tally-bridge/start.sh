#!/usr/bin/env bash
# Start the Tally Bridge middleware (Linux/macOS)
# First time:  pip install -r requirements.txt
set -e
cd "$(dirname "$0")"
export BRIDGE_HOST="${BRIDGE_HOST:-127.0.0.1}"
export BRIDGE_PORT="${BRIDGE_PORT:-5000}"
echo "Starting Tally Bridge on http://$BRIDGE_HOST:$BRIDGE_PORT ..."
exec python3 server.py
