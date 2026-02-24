FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM base AS builder
RUN apk add --no-cache libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.16/main
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
# Skip linting and type checking for speed in staging, strict in prod
RUN npx prisma generate
RUN npm run build

# Compile custom server and worker for production efficiency
RUN node scripts/compile-server.js

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install Prisma engine for Alpine
RUN apk add --no-cache openssl libssl1.1 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.16/main

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy Prisma for migrations/client access
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Ensure worker dependencies are available at runtime (not bundled by esbuild or next)
# We run this after copies to ensure we supplement the standalone node_modules
RUN npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth && \
    chown -R nextjs:nodejs /app/node_modules

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use server-custom.js (compiled with Socket.io) by default
CMD ["node", "server-custom.js"]
