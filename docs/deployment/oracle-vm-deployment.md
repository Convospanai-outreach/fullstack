# Oracle Cloud VM Deployment: Render Main API + Render Worker

This guide replaces two Render services with two self-managed Oracle Cloud (OCI) VMs:

| Today (Render) | Becomes (Oracle) |
|---|---|
| `fullstack` web service (`apps/api`, `server.ts`, port 3001) — the "main task" | **VM 1 — `api-main`** |
| `fullstack-worker` (defined in `render.yaml`, `start-workers.ts`) — currently **not actually deployed anywhere** (see `OPEN_ITEMS.md` OPEN-08) | **VM 2 — `api-worker`** |

**Not changing:** `apps/web` stays on Vercel. Postgres stays on Neon. Redis stays wherever it is today. This guide only moves the two Render-hosted Node processes onto Oracle VMs.

**Decisions this guide assumes** (confirmed with you before writing this):
- Two separate VMs, one per service.
- Docker on both VMs, reusing `apps/api/Dockerfile` unchanged — same image, different container command, exactly like `render.yaml` does today (`dockerCommand` override for the worker).
- Database/Redis stay managed (Neon + your existing Redis) — the VMs run app code only.
- Deploys are automated via GitHub Actions: on push to `main`, a workflow builds the image once, pushes it to GHCR, and both VMs pull + restart.

**Read this before you start:** the worker has been dead in production (per `OPEN_ITEMS.md` OPEN-08). The moment `api-worker` comes up and connects to production Redis/Postgres, it will start actually processing campaign sends, Gmail sync, and sequence follow-ups for the first time. That's a real behavior change, not just a hosting change — do the worker cutover deliberately, ideally at a low-traffic time, and watch logs closely for the first hour.

---

## 0. Prerequisites

- An Oracle Cloud account ("Always Free" tier is enough for both VMs).
- Your current Render env var values for the `fullstack` web service (Render's API only supports *writing* env vars, not reading them back — pull the current values from the Render dashboard → `fullstack` service → Environment tab, and copy them somewhere safe temporarily).
- Access to `apps/api/.env.example` in this repo as the checklist of what's needed (already read — see Section 5).
- A GitHub repo secret store you can write to (for the Actions workflow in Section 7).
- A domain (or subdomain) you control if you want the main API to be reachable over HTTPS at a stable name (e.g. `api.craftmyfunnel.com`, matching `hosting-plan.md`'s target layout). Not required if you're fine reaching it by IP:port for now.
- **Optional but recommended, unresolved from OPEN-21:** the Neon DB password and Google OAuth client secret were flagged for rotation after a prior transcript exposure and never rotated. Since you're re-entering all secrets into a new place anyway, this is a natural point to rotate them — your call, not required by this migration.

---

## 1. Provision the two Oracle VMs

### 1.1 Shape selection

Oracle's Always Free tier gives you a choice of shapes. Pick one track:

- **Recommended: Ampere A1 (ARM, `VM.Standard.A1.Flex`)** — free allocation is 4 OCPUs / 24 GB RAM total, split however you like. Use **2 OCPU / 12 GB per VM**. Plenty of headroom for Node + Prisma + Docker. `node:22-alpine` (used by `apps/api/Dockerfile`) has native arm64 images, so no emulation needed.
- **Fallback: AMD Micro (`VM.Standard.E2.1.Micro`)** — 2 free instances, 1 OCPU / 1 GB RAM each. Ampere capacity is sometimes unavailable ("out of host capacity") in a given region — if so, use this instead. 1 GB is too tight to *build* the Docker image on the VM, but that's fine: this guide builds images in GitHub Actions (Section 7), never on the VM, so this shape works for either track.

If Ampere gives "out of host capacity" on creation, retry a few times or in a different Availability Domain before falling back to AMD — it's a transient capacity issue, not a config problem.

### 1.2 Create the instances

For **each** VM (`api-main`, `api-worker`):

1. OCI Console → **Compute → Instances → Create Instance**.
2. Name: `api-main` / `api-worker`.
3. Image: **Ubuntu 24.04 (Canonical)**.
4. Shape: as chosen in 1.1.
5. Networking: let the wizard create a new VCN on the first instance ("create new virtual cloud network"), then place the second instance in the **same VCN**, same subnet, so they can reach each other privately if ever needed (not required today, but free to keep).
6. **Assign a public IP.** Then, after creation, go to the attached VNIC → reserve the ephemeral public IP as a **Reserved Public IP** so it survives a stop/start (Always Free tier includes this).
7. SSH keys: generate a new keypair (`ssh-keygen -t ed25519 -f oracle-fullstack -C "fullstack-deploy"`) and paste the public key in, or upload an existing one. Keep the private key — you'll also need it as a GitHub Actions secret in Section 7.
8. Boot volume: default (50 GB) is fine for both.
9. Create.

Note the public IP of each instance once running.

### 1.3 Open the required ports

OCI firewalls at **two layers** — both must allow the traffic, this is the most common OCI gotcha:

**A. Security List / NSG (cloud-level firewall)**
VCN → Security Lists → your subnet's list → Ingress Rules → Add:

- `api-main`: allow TCP 22 (SSH, ideally source-restricted to your IP), TCP 80 and TCP 443 (HTTP/HTTPS, source `0.0.0.0/0`).
- `api-worker`: allow TCP 22 only (SSH, source-restricted to your IP). The worker needs no inbound public traffic — it only makes outbound calls to Postgres, Redis, Google, and your LLM providers.

**B. The VM's own iptables (Oracle's Ubuntu images ship with restrictive iptables rules by default)**
SSH into each VM and run:

```bash
sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT   # api-main only
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT  # api-main only
sudo netfilter-persistent save
```

(Skip the 80/443 lines on `api-worker`.)

---

## 2. Base OS setup (run on both VMs)

```bash
ssh -i oracle-fullstack ubuntu@<VM_PUBLIC_IP>

sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw fail2ban unattended-upgrades

# Enable unattended security patches
sudo dpkg-reconfigure -plow unattended-upgrades

# ufw as a second, easier-to-read local firewall layer
sudo ufw allow OpenSSH
sudo ufw enable
```

On `api-main` only, also:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 3. Install Docker (both VMs)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker   # or log out/in
docker compose version   # confirm the compose plugin is present
```

---

## 4. Set up GHCR image pulls (both VMs)

The image is built once in GitHub Actions (Section 7) and pushed to GitHub Container Registry. Each VM just pulls it. Authenticate Docker on each VM to GHCR using a GitHub Personal Access Token with `read:packages` scope:

```bash
echo "<GHCR_READ_TOKEN>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

---

## 5. Environment variables

Create `/opt/fullstack/.env` on **both** VMs (`sudo mkdir -p /opt/fullstack && sudo chown ubuntu:ubuntu /opt/fullstack`), populated from your current Render env vars plus `apps/api/.env.example` as the checklist.

**Shared by both VMs** (from `render.yaml`'s existing worker config, plus what `apps/api` needs to boot at all):

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=<from Render / Neon pooled connection>
DIRECT_URL=<from Render / Neon direct connection>
REDIS_URL=<your existing Redis, if used>
EDGE_NODE_URI=<from Render>
EDGE_NODE_OPTIONAL=true
NEXTAUTH_URL=<from Render>
NEXTAUTH_SECRET=<from Render>
ENCRYPTION_KEY=<from Render — required, mailbox OAuth tokens are encrypted at rest with this>
```

**`api-main`-only additions** (the worker doesn't serve HTTP or need these — copy the rest of the values your current Render `fullstack` web service actually has set, using `apps/api/.env.example` in this repo as the full checklist: Google OAuth, Razorpay, Resend, SMTP, OpenAI/Anthropic/Google/Groq keys, `CRON_SECRET`, `SOCKET_SHARED_SECRET`, `EXTENSION_API_KEY`, `ALLOWED_ORIGINS`, `HUNTER_API_KEY`, WhatsApp vars, etc.).

**`api-worker`-only addition** (from `render.yaml`):

```env
WORKER_CONCURRENCY=5
```

Lock the file down: `chmod 600 /opt/fullstack/.env` on both VMs.

---

## 6. Docker Compose files

### 6.1 `api-main` — `/opt/fullstack/docker-compose.yml`

```yaml
services:
  api:
    image: ghcr.io/<your-org>/<your-repo>:latest
    container_name: api-main
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:3001:3001"   # only reachable via the reverse proxy, not directly
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

(`apps/api/Dockerfile`'s default `CMD` runs `server.ts` — the "main" process — with no override needed here, and `wget` is already installed in the runtime image.)

### 6.2 `api-worker` — `/opt/fullstack/docker-compose.yml`

```yaml
services:
  worker:
    image: ghcr.io/<your-org>/<your-repo>:latest
    container_name: api-worker
    restart: unless-stopped
    env_file: .env
    command: ["node", "../../node_modules/tsx/dist/cli.mjs", "src/workers/start-workers.ts"]
```

(Same image as `api-main`, command overridden — mirrors `render.yaml`'s `dockerCommand` for the worker exactly.)

### 6.3 First manual run (before CI/CD is wired up)

On each VM:

```bash
cd /opt/fullstack
docker compose pull
docker compose up -d
docker compose logs -f   # watch startup, Ctrl+C when healthy
```

---

## 7. Reverse proxy + TLS (`api-main` only)

Use Caddy — automatic HTTPS via Let's Encrypt, minimal config.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
api.craftmyfunnel.com {
    reverse_proxy 127.0.0.1:3001
}
```

Point the domain's DNS A record at the VM's reserved public IP first, then:

```bash
sudo systemctl restart caddy
curl -I https://api.craftmyfunnel.com/health
```

Caddy handles certificate issuance and renewal automatically. No domain yet? Skip this section for now and reach the API at `http://<VM_PUBLIC_IP>:3001` directly (change the compose port binding from `127.0.0.1:3001:3001` to `3001:3001` if you do this, and keep it firewalled to trusted IPs).

---

## 8. Survive reboots

`docker compose up -d` with `restart: unless-stopped` already brings containers back after a VM reboot once Docker itself starts (Docker's systemd unit is enabled by default after `get.docker.com` install — confirm with `systemctl is-enabled docker`). No extra systemd unit is needed beyond that.

Run the Prisma migration once, from `api-main` only, before first boot (the worker connects to the same DB and needs the schema already migrated):

```bash
docker compose run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

---

## 9. GitHub Actions: build once, deploy to both VMs

Repo secrets to add (GitHub repo → Settings → Secrets and variables → Actions):

- `ORACLE_SSH_KEY` — the private key from Section 1.2.
- `ORACLE_API_MAIN_HOST`, `ORACLE_API_WORKER_HOST` — the two public IPs (or the domain for `api-main`).
- `ORACLE_SSH_USER` — `ubuntu`.
- `GHCR_TOKEN` — a PAT with `write:packages` (or reuse `GITHUB_TOKEN`, which already has this scope for the repo's own packages).

`.github/workflows/deploy-oracle.yml`:

```yaml
name: Deploy to Oracle VMs

on:
  push:
    branches: [main]
    paths:
      - "apps/api/**"
      - "packages/**"
      - "package.json"
      - "package-lock.json"

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    strategy:
      matrix:
        host_secret: [ORACLE_API_MAIN_HOST, ORACLE_API_WORKER_HOST]
    steps:
      - name: Deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets[matrix.host_secret] }}
          username: ${{ secrets.ORACLE_SSH_USER }}
          key: ${{ secrets.ORACLE_SSH_KEY }}
          script: |
            cd /opt/fullstack
            docker compose pull
            docker compose up -d
            docker image prune -f
```

This matches `render.yaml`'s `autoDeploy: true`: every push to `main` that touches `apps/api` or shared packages rebuilds the one image and rolls it out to both VMs.

---

## 10. Cutover

Do this in order, not all at once:

1. **Bring up `api-main` first, `api-worker` second, days apart if you want a safety margin** — the worker is the part with unverified production behavior (OPEN-08).
2. Point `apps/web`'s `NEXT_PUBLIC_API_URL` (Vercel env var) at the new `api-main` address. Redeploy `apps/web`.
3. Smoke test: log in, load the dashboard, send a test action that hits `apps/api`.
4. Bring up `api-worker`. Watch `docker compose logs -f` on that VM for the first campaign send / Gmail sync cycle — this is genuinely new production behavior, not a repeat of something already running elsewhere.
5. Once both are confirmed stable for a few days, suspend (don't delete yet) the Render `fullstack` service so you can roll back fast if something surfaces. Delete it only after you're confident.

---

## 11. Ongoing operations

- **Logs:** `docker compose logs -f --tail 200` on either VM. Consider `docker compose logs --since 1h > /tmp/out.log` before you SSH away, if you want a paper trail.
- **Updating secrets:** edit `/opt/fullstack/.env`, then `docker compose up -d` to restart with the new values (compose picks up `.env` changes on recreate, not on a bare restart).
- **Manual redeploy without waiting for CI:** `cd /opt/fullstack && docker compose pull && docker compose up -d` on either VM.
- **Boot volume backups:** OCI Always Free includes limited free block volume backups — Console → Boot Volume → your VM's boot volume → Backups → set a weekly policy for both VMs.
- **Health:** `api-main`'s `/health` endpoint is already wired into the Compose healthcheck (Section 6.1) and is what Render was using — reuse it for any external uptime monitor you set up (e.g. a free UptimeRobot check against `https://api.craftmyfunnel.com/health`).
