# ============================================================================
# TrafficLab — all-in-one container image (TEMPLATE, not yet CI-tested)
#
# Runs dashboard (:3000) + engine-service (:3003/:3004) + Python/Selenium
# engine with distro chromium, supervised by a tiny start script.
#
# Suitable for Railway / Render / Fly.io / any Docker host. On Fly.io use
# `fly launch --no-deploy`, set the app port to 3000, then `fly deploy`.
#
# Build:  docker build -t trafficlab .
# Run:    docker run -p 3000:3000 -p 3003:3003 trafficlab
# ============================================================================

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    BUN_INSTALL=/usr/local/bun \
    PATH="/usr/local/bun/bin:${PATH}"

# --- system deps: chromium + python + node-ish toolchain --------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium chromium-driver \
        python3 python3-venv python3-pip \
        curl ca-certificates unzip git \
    && rm -rf /var/lib/apt/lists/*

# --- bun ---------------------------------------------------------------------
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

# --- dashboard deps ----------------------------------------------------------
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- python engine ------------------------------------------------------------
COPY engine/ ./engine/
RUN python3 -m venv engine/venv \
    && engine/venv/bin/pip install --no-cache-dir -r engine/requirements.txt
# distro chromium is auto-discovered via PATH by main.py (find_chrome_binary)

# --- engine-service ------------------------------------------------------------
COPY mini-services/engine-service/package.json mini-services/engine-service/bun.lock* ./mini-services/engine-service/
RUN cd mini-services/engine-service && bun install

# --- app code + build -----------------------------------------------------------
COPY . .
RUN DATABASE_URL=file:/app/db/custom.db bunx prisma generate \
    && NEXT_PUBLIC_ENGINE_SOCK_PATH=/engine-socket/socket.io \
       NEXT_PUBLIC_ENGINE_BASE_URL="" \
       DATABASE_URL=file:/app/db/custom.db \
       bun run build \
    && cp -r .next/static .next/standalone/.next/ \
    && cp -r public .next/standalone/

ENV NODE_ENV=production \
    DATABASE_URL=file:/app/db/custom.db \
    ENGINE_DIR=/app/engine \
    PORT=3003 \
    REST_PORT=3004 \
    NEXT_APP_URL=http://127.0.0.1:3000 \
    CHROME_BINARY=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver

EXPOSE 3000 3003

# tiny supervisor: engine-service in background, dashboard in foreground
CMD ["bash", "-c", "cd mini-services/engine-service && bun index.ts & sleep 1; exec bun .next/standalone/server.js"]
