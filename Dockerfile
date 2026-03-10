# Stage 1: Base image with shared environment settings
FROM node:20-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Stage 2: Install dependencies (only what's needed for build)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# Use npm ci for reproducible builds and clean cache in same layer to minimize layer size
RUN npm ci && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client, Build Next.js, and compile Custom Server/Worker
RUN npx prisma generate && \
    npm run build && \
    node scripts/compile-server.js && \
    # Clean up build-only files to save space in builder stage memory (though not strictly necessary for final size)
    rm -rf src/ tests/ e2e/ docs/ scripts/

# Stage 4: Production runner for ConvoSpan WEB
FROM base AS runner-web
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    # Install minimal runtime dependencies (Prisma needs openssl)
    apk add --no-cache openssl libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.16/main && \
    # Ensure proper permissions for the runner
    mkdir .next && \
    chown nextjs:nodejs .next

# Copy only the necessary standalone build artifacts from builder stage (highly minimized)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy Prisma for potential migrations or client runtime needs
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Use standalone server entrypoint (Next.js standard) or server-custom.js (socket.io enabled)
# For web, we use server-custom.js to enable real-time features
CMD ["node", "server-custom.js"]

# Stage 5: Production runner for ConvoSpan WORKER
FROM base AS runner-worker
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    # Install minimal runtime dependencies (Prisma needs openssl)
    apk add --no-cache openssl libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.16/main

# Workers often need specific node modules that are 'external' in esbuild
# We copy node_modules from deps to ensure they are available
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/worker.js ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

# The worker-only entrypoint
CMD ["node", "worker.js"]
