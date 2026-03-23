# ConvoSpan Split Apps

This folder contains a hard split into three standalone app folders:

- `web` - Next.js application
- `api` - Fastify API server
- `edge-fastapi` - FastAPI edge runtime

## Docker images

- `convospan-web:split`
- `convospan-api:split`
- `convospan-edge-fastapi:split`

## Build all images

```bash
docker compose -f docker-compose.split.yml build
```

## Run all apps

```bash
docker compose -f docker-compose.split.yml up -d
```
