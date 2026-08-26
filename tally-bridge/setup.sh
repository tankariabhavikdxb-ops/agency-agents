#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Tally Prime 2.1 - Web Interface Setup (Linux / macOS)
# Creates a virtual environment, installs pinned dependencies and a .env
# ═══════════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  Tally Prime 2.1 - Web Interface Setup"
echo "============================================"
echo

# ── 1. Check Python 3.9+ ──────────────────────────────────────────────────
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 \
     && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  echo "[ERROR] Python 3.9+ was not found."
  echo "        Install it from https://www.python.org/downloads/ or:"
  echo "        Debian/Ubuntu:  sudo apt install python3 python3-venv python3-pip"
  exit 1
fi
echo "[OK] Found $($PY --version)"

# ── 2. Create virtual environment ─────────────────────────────────────────
if [ -x "venv/bin/python" ]; then
  echo "[OK] Virtual environment already exists (venv/)."
else
  echo
  echo "Creating virtual environment in venv/ ..."
  if ! "$PY" -m venv venv; then
    echo "[ERROR] Could not create the virtual environment."
    echo "        Debian/Ubuntu: sudo apt install python3-venv"
    exit 1
  fi
  echo "[OK] Virtual environment created."
fi
VPY="venv/bin/python"

# ── 3. Upgrade pip ────────────────────────────────────────────────────────
echo
echo "Upgrading pip ..."
"$VPY" -m pip install --upgrade pip --disable-pip-version-check --quiet \
  || echo "[WARN] pip upgrade failed - continuing with existing pip."

# ── 4. Install dependencies ───────────────────────────────────────────────
echo
echo "Installing dependencies - this can take a minute ..."
if ! "$VPY" -m pip install -r requirements.txt --disable-pip-version-check; then
  echo
  echo "[WARN] Full install failed - retrying without the optional ODBC driver ..."
  TMPREQ="$(mktemp)"
  grep -vi 'pyodbc' requirements.txt > "$TMPREQ"
  if ! "$VPY" -m pip install -r "$TMPREQ" --disable-pip-version-check; then
    echo "[ERROR] Dependency installation failed."
    echo "        Check your internet connection and run ./setup.sh again."
    rm -f "$TMPREQ"
    exit 1
  fi
  rm -f "$TMPREQ"
  echo "[WARN] pyodbc was skipped - the bridge will run in XML-API-only mode."
  echo "       Every feature still works; ODBC is an optional faster read path."
fi

# ── 5. Create .env from the example (keep an existing one) ────────────────
echo
if [ -f .env ]; then
  echo "[OK] Existing .env kept."
elif [ -f .env.example ]; then
  cp .env.example .env
  echo "[OK] Created .env from .env.example."
  echo "     Open it in an editor to point the bridge at your Tally if"
  echo "     it runs on another PC (LAN) or a non-default port."
else
  echo "[WARN] .env.example not found - defaults will be used."
fi

# ── 5b. Verify pyodbc actually loads (needs the unixODBC system library) ──
if ! "$VPY" -c "import pyodbc" >/dev/null 2>&1; then
  echo
  echo "[WARN] pyodbc is installed but cannot load its system library."
  echo "       The bridge will run in XML-API-only mode (all features work)."
  echo "       To enable the optional ODBC fast path on Linux:"
  echo "         sudo apt install unixodbc        # Debian/Ubuntu"
  echo "         sudo dnf install unixODBC         # Fedora/RHEL"
fi

# ── 6. Done ───────────────────────────────────────────────────────────────
echo
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo
echo "  How to start:"
echo "    ./run.sh        (or: venv/bin/python server.py)"
echo
echo "  The app will be at  http://127.0.0.1:5000"
echo
echo "  Checklist before starting:"
echo "    1. Tally Prime 2.1 is running with a company open"
echo "    2. In Tally: Help → Settings → Connectivity"
echo "       set 'TallyPrime acts as' = Both (ODBC + XML API), port 9000"
echo
read -r -p "Start the bridge now? [y/N]: " ans || true
if [ "${ans:-}" = "y" ] || [ "${ans:-}" = "Y" ]; then
  exec ./run.sh
fi
