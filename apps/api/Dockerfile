# Build Stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npx prisma generate

# Final Stage
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Add wget for healthcheck
RUN apk add --no-cache wget

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3001
CMD ["node_modules/.bin/tsx", "server.ts"]
