# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
# Cache bust: force fresh npm ci to resolve picomatch CVE-2026-33671
WORKDIR /repo

# Install workspace dependencies from the monorepo root lockfile so the
# image matches the repo's real install model.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages
# apps/web postinstall executes scripts/repair-package-exports.mjs during npm ci.
COPY apps/web/scripts ./apps/web/scripts
RUN sh -c 'for attempt in 1 2 3; do \
      npm ci --workspace apps/web --include-workspace-root --no-audit --no-fund --legacy-peer-deps --prefer-offline --fetch-retries=5 --fetch-retry-maxtimeout=120000 && exit 0; \
      echo "npm ci failed on attempt ${attempt}, retrying..." >&2; \
      sleep 5; \
    done; \
    exit 1'

# =============================================================================
# Builder Stage: compile Next.js with Prisma client
# =============================================================================
FROM node:22-alpine AS builder
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time DB URL (no real DB needed to build)
ARG DATABASE_URL="postgresql://dummy:dummy@localhost/dummy"
ARG ENCRYPTION_KEY="buildtime-encryption-key-123456"
ARG NEXT_PUBLIC_API_URL="http://localhost:3000/api/proxy"
ENV DATABASE_URL=$DATABASE_URL
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .

WORKDIR /repo/apps/web

# Generate Prisma client and build Next.js
RUN DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" npx prisma generate && \
    DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" \
    ENCRYPTION_KEY="${ENCRYPTION_KEY}" \
    NEXT_OUTPUT_MODE="standalone" \
    NODE_OPTIONS="--max-old-space-size=4096" \
    npx next build

# =============================================================================
# Runner Stage: minimal production image
# =============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Add wget for healthcheck support
RUN apk add --no-cache wget

# Non-root user for security
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output (fastest startup)
# Copy only what Next.js needs at runtime
COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./.next/static
COPY --from=builder /repo/apps/web/prisma ./prisma
COPY --from=builder /repo/apps/web/scripts ./scripts
# node_modules already bundled in standalone output

RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /opt/yarn* \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
