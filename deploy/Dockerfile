# ============================================================================
# TrafficLab — all-in-one container image
#
# Runs dashboard (:3000) + engine-service (:3003/:3004) + Python/Selenium
# engine with distro chromium, in ONE container (localhost coupling).
#
# Build & run:      docker compose up -d --build
# (or manually:     docker build -t trafficlab . && docker run -p 3000:3000 trafficlab)
#
# Chrome runs headless with --no-sandbox (already set by engine/main.py),
# so no X server is needed. SQLite lives at /app/db/custom.db — mount ./db
# to persist run history across container rebuilds.
# ============================================================================

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    BUN_INSTALL=/usr/local/bun \
    PATH="/usr/local/bun/bin:${PATH}"

# --- system deps: chromium + python + curl (healthcheck) ---------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium chromium-driver \
        python3 python3-venv \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- bun ---------------------------------------------------------------------
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

# --- dashboard deps (layer-cached) --------------------------------------------
COPY package.json bun.lock ./
RUN bun install

# --- python engine -------------------------------------------------------------
COPY engine/ ./engine/
RUN python3 -m venv engine/venv \
    && engine/venv/bin/pip install --no-cache-dir -r engine/requirements.txt
# distro chromium/chromedriver are auto-discovered by engine/main.py

# --- engine-service -------------------------------------------------------------
COPY mini-services/engine-service/package.json mini-services/engine-service/bun.lock* ./mini-services/engine-service/
RUN cd mini-services/engine-service && bun install

# --- app code + production build --------------------------------------------------
COPY . .
RUN DATABASE_URL=file:/app/db/custom.db bunx prisma generate \
    && NEXT_PUBLIC_ENGINE_SOCK_PATH=/engine-socket/socket.io \
       DATABASE_URL=file:/app/db/custom.db \
       bun run build \
    && cp -r .next/static .next/standalone/.next/ \
    && cp -r public .next/standalone/

ENV NODE_ENV=production \
    DATABASE_URL=file:/app/db/custom.db \
    ENGINE_DIR=/app/engine \
    NEXT_APP_URL=http://127.0.0.1:3000 \
    SOCK_PATH=/engine-socket/socket.io \
    CHROME_BINARY=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver

EXPOSE 3000 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

# 1) ensure SQLite schema exists (volume-mounted ./db on first run),
# 2) engine-service in background, 3) dashboard in foreground.
CMD ["bash", "-c", "bunx prisma db push --skip-generate 2>/dev/null || bunx prisma db push; cd mini-services/engine-service && bun index.ts & sleep 2; exec bun .next/standalone/server.js"]
