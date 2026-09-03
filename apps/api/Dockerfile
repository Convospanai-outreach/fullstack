# syntax=docker/dockerfile:1.7
# Dependencies stage (workspace-aware install for monorepo)
FROM node:22-alpine AS deps
WORKDIR /repo

# Puppeteer's bundled Chromium is glibc-linked and won't run on Alpine's musl libc;
# skip its download here and use the apk-installed chromium in the runtime stage instead.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages

RUN sh -c 'for attempt in 1 2 3; do \
      npm ci --workspace apps/api --include-workspace-root --no-audit --no-fund --legacy-peer-deps --prefer-offline --fetch-retries=5 --fetch-retry-maxtimeout=120000 && exit 0; \
      echo "npm ci failed on attempt ${attempt}, retrying..." >&2; \
      sleep 5; \
    done; \
    exit 1'

# Build artifacts needed at runtime
FROM node:22-alpine AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY --from=deps /repo/package-lock.json ./package-lock.json
COPY --from=deps /repo/apps ./apps
COPY --from=deps /repo/packages ./packages

COPY apps/api ./apps/api

RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dummy" npx prisma generate --schema apps/api/prisma/schema.prisma

# Final runtime image
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Pull latest patched OS packages (openssl CVEs etc.) before installing anything else
RUN apk upgrade --no-cache

RUN apk add --no-cache wget chromium nss freetype harfbuzz ca-certificates ttf-freefont

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 3001
CMD ["node", "../../node_modules/tsx/dist/cli.mjs", "server.ts"]
