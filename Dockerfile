# Stage 1: Base image with shared environment settings
FROM node:20-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

# Stage 2: Install all dependencies (neccessary for build)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# Set NODE_ENV to development so devDependencies are installed
ENV NODE_ENV=development
# Install ALL dependencies (including devDependencies like cross-env) for the build process
RUN npm ci && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Set NODE_ENV to development for the build process
ENV NODE_ENV=development
# Generate Prisma client, Build Next.js, and compile Custom Server/Worker
RUN npx prisma generate && \
    npm run build && \
    node scripts/compile-server.js && \
    # Clean up build-only files to save space
    rm -rf src/ tests/ e2e/ docs/ scripts/

# Stage 4: Production runner for ConvoSpan WEB
FROM base AS runner-web
WORKDIR /app
# Set production environment for the runner
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    # Install minimal runtime dependencies (Prisma needs openssl)
    apk add --no-cache openssl libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.16/main && \
    # Ensure proper permissions for the runner
    mkdir .next && \
    chown nextjs:nodejs .next

# Copy only the necessary standalone build artifacts from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy Prisma for client runtime needs
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Use standalone server-custom.js (socket.io enabled)
CMD ["node", "server-custom.js"]

# Stage 5: Production runner for ConvoSpan WORKER
FROM base AS runner-worker
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache openssl libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.16/main

# Workers need their own set of production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy compiled worker and prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/worker.js ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

# The worker-only entrypoint
CMD ["node", "worker.js"]
