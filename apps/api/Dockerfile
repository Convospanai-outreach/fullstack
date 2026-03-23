FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN npx prisma generate

EXPOSE 3001
CMD ["npm", "run", "start"]
