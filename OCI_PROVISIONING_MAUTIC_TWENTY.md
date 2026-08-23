# OCI VM Provisioning Runbook — Mautic + Twenty CRM

One dedicated VM hosting both apps (per Phase 0 decision in
`TODO_MAUTIC_TWENTY_INTEGRATION.md`): OCI Always Free **Ampere A1 Flex**
shape, sized 2 OCPU / 4–6GB RAM. Separate from the existing `api-main` /
`api-worker` VMs that run production `apps/api`. **Provisioned manually via
the OCI Console** — no CLI/API key needed for this part.

Status tracker — check off as each part completes:

- [ ] Part A — VM created via OCI Console
- [ ] Part B — networking/firewall opened (both layers)
- [ ] Part C — SSH access confirmed
- [ ] Part D — OS-level prep for Twenty + Mautic done

---

## Part A — Create the compute instance (OCI Console)

1. OCI Console → **Compute** → **Instances** → **Create Instance**
2. **Name**: `mautic-twenty-pilot`
3. **Placement**: pick the same compartment `api-main`/`api-worker` live in
   (unless you want this isolated in its own compartment — your call)
4. **Image and shape**:
   - Image: **Canonical Ubuntu 24.04** (same as `api-main`/`api-worker`)
   - Shape: click **Change Shape** → **Ampere** → **VM.Standard.A1.Flex** →
     set **2 OCPUs** / **6 GB memory** (Always Free tier covers up to 4
     OCPU/24GB total across your Ampere instances — confirm this doesn't push
     you over if `api-main`/`api-worker` already use Ampere shapes too; if
     they're AMD/Intel shapes this is unrelated free-tier quota)
5. **Networking**:
   - VCN: reuse the existing VCN `api-main`/`api-worker` are on, or create a
     new one — either works, reusing is simpler for DNS/firewall management
   - Subnet: a **public subnet** (needs a public IP to serve Caddy/HTTPS
     directly, same as the existing VMs)
   - **Assign a public IPv4 address**: yes
6. **Add SSH keys**: paste the **public** key you want to use for login —
   either your existing `oracle-key.pub` (matching the private key at
   `~/.ssh/oracle-key.key` you already use for `api-main`), or generate a new
   dedicated keypair for this VM
7. **Boot volume**: defaults are fine for a pilot
8. Click **Create**. Wait for state **Running**, then note the **public IP**
   shown on the instance detail page.

→ verify: instance state shows **Running** with a public IP assigned.

---

## Part B — Networking / firewall (both layers — this bit us last time)

Per `feedback_oci_two_layer_firewall`: OCI has **two independent firewall
layers**, and both must be opened or the VM looks reachable from inside but
isn't from outside.

1. **OCI Security List / NSG** (cloud layer, Console): on the instance's
   subnet → **Security Lists** (or attach a dedicated **Network Security
   Group** to the instance) → **Add Ingress Rules**:
   - Source `0.0.0.0/0`, TCP, destination port **80**
   - Source `0.0.0.0/0`, TCP, destination port **443**
   - Source *your IP only* (not `0.0.0.0/0`), TCP, destination port **22**
2. **VM's own firewall** (OS layer, Ubuntu 24.04 default — `ufw`), once
   SSH'd in (Part C): `sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`

→ verify (from **outside** the VM, not from inside it — an in-VM check
proves nothing per `feedback_devtcp_reachability_test_pitfall`): from this
machine, `curl -I http://<public_ip>` and `curl -I https://<public_ip> -k`
return a response (even a connection-refused-by-app is fine at this stage —
timeout means the firewall layer is still blocking) instead of hanging.

---

## Part C — SSH access

```bash
ssh -i ~/.ssh/oracle-key.key ubuntu@<public_ip>
```
(or the new dedicated key, if you generated one in Part A.)

→ verify: shell prompt on the VM as `ubuntu`.

---

## Part D — OS-level prep for both apps

Once SSH'd in:

1. `sudo apt update && sudo apt install -y docker.io docker-compose-plugin`
2. `sudo usermod -aG docker ubuntu` (log out/in to take effect)
3. Add swap (recommended given the 2 OCPU/6GB shape running 8 containers —
   Twenty (server+worker+db+redis) + Mautic (web+cron+db) + Caddy):
   `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
   then persist in `/etc/fstab`
4. Point DNS: create/update `twenty.<domain>` and `mautic.<domain>` A records
   at Cloudflare to this VM's public IP (grey-clouded initially, per Phase 0)
5. Clone/copy `docker-compose.mautic-twenty.yml` + `Caddyfile` (built in
   Phase 2 of the main TODO list) onto the VM and `docker compose up -d`

This is where the runbook hands off to `TODO_MAUTIC_TWENTY_INTEGRATION.md`
Phase 2 onward (the compose stack for Twenty CRM + Mautic themselves).

---

## What I need from you to proceed

1. The VM's **public IP** once Part A is done
2. Confirmation the SSH key you added is the existing `oracle-key` or a new
   one (and its path, if new)
3. Confirmation Part B's ingress rules are in place, or a go-ahead for me to
   walk through the `ufw` side once I'm SSH'd in


pii redaction
miniai using openrouter
workflow creator 
small ai agent to create and automate workflow