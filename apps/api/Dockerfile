# Dependencies stage (workspace-aware install for monorepo)
FROM node:22-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages

RUN npm ci --workspace apps/api --include-workspace-root --no-audit --no-fund --legacy-peer-deps

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

RUN apk add --no-cache wget

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 3001
CMD ["node", "../../node_modules/tsx/dist/cli.mjs", "server.ts"]
