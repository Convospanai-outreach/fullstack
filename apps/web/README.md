# CraftMyFunnel Web App

Next.js web application inside the CraftMyFunnel monorepo.

## Run locally

From the repository root:

```bash
npm install
npm run dev --workspace apps/web
```

## Build Docker image

From the repository root:

```bash
npm run docker:web
```

The web Docker build uses the monorepo root context so it can install from the shared workspace lockfile.

## Default port

- `3000`
