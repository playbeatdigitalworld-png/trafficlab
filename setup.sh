#!/usr/bin/env bash
# ============================================================================
# TrafficLab — one-shot setup (Linux / macOS)
#
# Installs everything needed to run the full stack on one machine:
#   1. dashboard dependencies (bun install)
#   2. .env with an absolute SQLite path + prisma schema push
#   3. Python engine venv + requirements
#   4. portable Chrome for Testing + chromedriver (skip with SKIP_DRIVERS=1)
#   5. engine-service dependencies
#
# Usage:   ./setup.sh           (normal)
#          SKIP_DRIVERS=1 ./setup.sh   (if Chrome/chromium is already installed)
# ============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m ✔ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m ✖ %s\033[0m\n' "$*" >&2; exit 1; }

# --- 0. prerequisites ---------------------------------------------------------
say "Checking prerequisites"
command -v bun     >/dev/null 2>&1 || die "bun is required. Install: curl -fsSL https://bun.sh/install | bash"
command -v python3 >/dev/null 2>&1 || die "python3 is required (3.8+)."
command -v curl    >/dev/null 2>&1 || die "curl is required."
PYV="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
ok "bun $(bun --version) · python $PYV"

# --- 1. dashboard deps ---------------------------------------------------------
say "Installing dashboard dependencies (bun install)"
bun install
ok "dashboard dependencies installed"

# --- 2. .env + database ---------------------------------------------------------
say "Preparing .env and SQLite database"
if [[ ! -f .env ]]; then
  echo "DATABASE_URL=file:$REPO/db/custom.db" > .env
  ok "created .env (DATABASE_URL=file:$REPO/db/custom.db)"
else
  ok ".env already exists — leaving it untouched"
fi
mkdir -p db
bunx prisma generate
bunx prisma db push
ok "database ready (db/custom.db)"

# --- 3. python engine -----------------------------------------------------------
say "Creating Python engine virtualenv (engine/venv)"
if [[ ! -x engine/venv/bin/python ]]; then
  python3 -m venv engine/venv
fi
engine/venv/bin/pip install --quiet --upgrade pip
engine/venv/bin/pip install --quiet -r engine/requirements.txt
ok "engine venv ready (selenium installed)"

# --- 4. chrome driver/browser -----------------------------------------------------
if [[ "${SKIP_DRIVERS:-0}" = "1" ]]; then
  say "SKIP_DRIVERS=1 — skipping Chrome for Testing download"
  say "The engine will try: \$CHROME_BINARY, engine/drivers/, then system chrome/chromium in PATH."
elif [[ -x engine/drivers/chrome-linux64/chrome || -x engine/drivers/chrome-headless-shell-linux64/chrome-headless-shell ]]; then
  ok "engine/drivers already populated — skipping download"
else
  say "Downloading portable Chrome for Testing + chromedriver (~170 MB, no root needed)"
  bash engine/setup_drivers.sh || die "driver setup failed — install chromium + chromedriver via your package manager, or re-run"
fi

# --- 5. engine-service -------------------------------------------------------------
say "Installing engine-service dependencies"
( cd mini-services/engine-service && bun install )
ok "engine-service ready"

# --- done ---------------------------------------------------------------------------
cat <<'EOF'

  Setup complete. Start the two services in separate terminals:

    Terminal 1 — dashboard:
      bun run dev                      # development
      # or for production:
      # bun run build:prod && bun run start

    Terminal 2 — engine service:
      cd mini-services/engine-service && bun run dev

  Then open http://localhost:3000

  For VPS / production deployment see README.md → "Deployment".
EOF
