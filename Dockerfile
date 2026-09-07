# syntax=docker/dockerfile:1

# ==============================================================================
# MediaFlow Bot — production Docker image
# Bundles Node.js (Next.js app + Telegram bot webhook), yt-dlp and FFmpeg.
# ==============================================================================
FROM node:22-bookworm-slim AS base

# System dependencies: ffmpeg (audio/video processing) + python3/pip (yt-dlp)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip curl ca-certificates \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp \
    && apt-get purge -y --auto-remove python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next typegen && npm run build

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV TEMP_DIR=/tmp/mediaflow
RUN useradd --create-home --shell /bin/bash mediaflow \
    && mkdir -p /tmp/mediaflow && chown -R mediaflow:mediaflow /tmp/mediaflow

COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts

USER mediaflow
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
