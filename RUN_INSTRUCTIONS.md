# How to Run ConvoSpan Locally

This repo is a monorepo. The recommended local fast path is the beta orchestrator script, which starts Postgres + Redis (Docker) and then starts/reuses `apps/api` + `apps/web`.

## Prerequisites
- Docker Desktop installed and running.

## 1. Start the Application
Open your terminal in the project root (`d:\\Convo\\fullstack`) and run:

```bash
npm run beta:start
```

This will:
1. start `db` and `redis` containers (from `docker-compose.yml`)
2. push Prisma schema to the local DB
3. start API (`:3001`) and web (`:3000`)

## 2. Access the Application
Once the logs show that the server is running (you'll see a message like `Ready in ...`), open your web browser and go to:

**[http://localhost:3000](http://localhost:3000)**

## 3. Stop the Application
To stop the Node processes, press `Ctrl+C` in the terminal where it's running.

To remove the containers and network (clean up), run:
```bash
docker compose down
```

## Troubleshooting
- **Command not found**: If you see "The term 'docker' is not recognized", ensure Docker Desktop is installed and running. If you just installed it, **restart your terminal** or computer.
- **Port Conflicts**: If port 3000 or 5432 is already in use, you may need to stop other services or change the ports in `docker-compose.yml`.
- **Database Issues**: If you need to reset the database completely, run `docker compose down -v` (this **deletes** all data).
