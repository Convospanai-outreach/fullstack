# ConvoSpan API App

Standalone Fastify API extracted from the legacy monolith and the required shared `src/` modules.

## Run locally

```bash
npm install
npm run start
```

## Build Docker image

```bash
docker build -t convospan-api:split .
```

## Default port

- `3001`
