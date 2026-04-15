FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
# Use --legacy-peer-deps for compatibility, --no-audit for speed
RUN npm ci --no-audit --no-fund --legacy-peer-deps

# =============================================================================
# Builder Stage: compile Next.js with Prisma client
# =============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time DB URL (no real DB needed to build)
ARG DATABASE_URL="postgresql://dummy:dummy@localhost/dummy"
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build Next.js
RUN DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" npx prisma generate && \
    DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" \
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
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
# node_modules already bundled in standalone output

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
