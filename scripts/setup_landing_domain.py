"""
Set up a Cloudflare zone to host customer landing pages
=======================================================
Makes <zone> the landing pages domain: customers point their own domain at
pages.<zone> with one CNAME record, and the landing-pages Worker serves it.

1. Finds the zone and the LANDING_PAGES KV namespace (must match wrangler.jsonc)
2. Adds pages.<zone> as an originless proxied record (AAAA 100::)
3. Deploys workers/landing-pages with DEFAULT_HOST=pages.<zone>
4. Adds a no-Worker route for every other proxied name in the zone, so they
   keep working, then the catch-all */* route to the Worker
5. Sets pages.<zone> as the Cloudflare for SaaS fallback origin, if SaaS is on
6. Checks the excluded names still answer as before, and prints the app settings

Safe to run more than once. --dry-run only reads and prints the plan.

The API token needs: Zone Read, DNS Edit, Workers Routes Edit and SSL and
Certificates Edit on the zone; Workers Scripts Edit and Workers KV Storage Edit
on the account.

Usage (PowerShell, from the repo root):
    $env:CLOUDFLARE_API_TOKEN = "<token>"
    python scripts\\setup_landing_domain.py smc-india.services --dry-run
    python scripts\\setup_landing_domain.py smc-india.services
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"
WORKER = "craftmyfunnel-landing-pages"
KV_TITLE = "LANDING_PAGES"
WORKER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "workers", "landing-pages")


class CloudflareError(Exception):
    pass


def cf(token, method, path, body=None, query=""):
    req = urllib.request.Request(
        f"{API}{path}{query}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read())["result"]
    except urllib.error.HTTPError as e:
        try:
            errors = json.loads(e.read()).get("errors", [])
        except ValueError:
            errors = []
        raise CloudflareError("; ".join(f"{x.get('code')}: {x.get('message')}" for x in errors) or f"HTTP {e.code}")


def http_status(host):
    req = urllib.request.Request(f"https://{host}/", method="GET", headers={"User-Agent": "landing-setup-check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"error ({type(e).__name__})"


def wrangler_kv_id():
    text = open(os.path.join(WORKER_DIR, "wrangler.jsonc"), encoding="utf-8").read()
    match = re.search(r'"binding":\s*"LANDING_PAGES",.*?"id":\s*"([0-9a-f]*)"', text, re.S)
    return match.group(1) if match else ""


def deploy_worker(token, account_id, pages_host):
    npx = shutil.which("npx")
    if not npx:
        sys.exit("npx was not found; install Node.js, then run `npm install` in workers/landing-pages.")
    env = dict(os.environ, CLOUDFLARE_API_TOKEN=token, CLOUDFLARE_ACCOUNT_ID=account_id)
    result = subprocess.run([npx, "--no-install", "wrangler", "deploy", "--var", f"DEFAULT_HOST:{pages_host}"], cwd=WORKER_DIR, env=env)
    if result.returncode != 0:
        sys.exit("wrangler deploy failed; nothing after the DNS record was changed.")


def main():
    parser = argparse.ArgumentParser(description="Set up a Cloudflare zone to host customer landing pages.")
    parser.add_argument("zone", help="the domain on Cloudflare, e.g. smc-india.services")
    parser.add_argument("--dry-run", action="store_true", help="read only; print what would change")
    args = parser.parse_args()
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if not token:
        sys.exit("Set CLOUDFLARE_API_TOKEN first (see the top of this file).")
    zone_name = args.zone.lower().strip(".")
    pages_host = f"pages.{zone_name}"
    plan = "[dry run] would" if args.dry_run else "Will"

    zones = cf(token, "GET", "/zones", query=f"?name={zone_name}")
    if not zones:
        sys.exit(f"{zone_name} is not a zone this token can see. Add it to Cloudflare first.")
    zone_id, account_id = zones[0]["id"], zones[0]["account"]["id"]
    print(f"Zone {zone_name}: {zone_id} (account {account_id})")

    namespaces = cf(token, "GET", f"/accounts/{account_id}/storage/kv/namespaces", query="?per_page=100")
    kv = next((n for n in namespaces if n["title"] == KV_TITLE), None)
    if not kv or kv["id"] != wrangler_kv_id():
        sys.exit(f"KV namespace {KV_TITLE} is missing or differs from workers/landing-pages/wrangler.jsonc; fix that first.")
    print(f"KV namespace {KV_TITLE}: {kv['id']}")

    records = cf(token, "GET", f"/zones/{zone_id}/dns_records", query="?per_page=500")
    if any(r["name"] == pages_host for r in records):
        print(f"DNS {pages_host} already exists.")
    else:
        print(f"{plan} add DNS AAAA {pages_host} -> 100:: (proxied).")
        if not args.dry_run:
            cf(token, "POST", f"/zones/{zone_id}/dns_records", {"type": "AAAA", "name": pages_host, "content": "100::", "proxied": True, "ttl": 1, "comment": "Landing pages Worker and Cloudflare for SaaS fallback origin"})

    print(f"{plan} deploy the {WORKER} Worker with DEFAULT_HOST={pages_host}.")
    if not args.dry_run:
        deploy_worker(token, account_id, pages_host)

    keep = sorted({r["name"] for r in records if r.get("proxied") and r["name"] != pages_host})
    before = {host: http_status(host) for host in keep}
    routes = cf(token, "GET", f"/zones/{zone_id}/workers/routes")
    existing = {r["pattern"]: r.get("script") for r in routes}
    for host in keep:
        pattern = f"{host}/*"
        if pattern in existing:
            print(f"Route {pattern} already exists (Worker: {existing[pattern] or 'none'}).")
            continue
        print(f"{plan} add route {pattern} with no Worker, so {host} keeps working.")
        if not args.dry_run:
            cf(token, "POST", f"/zones/{zone_id}/workers/routes", {"pattern": pattern})
    if existing.get("*/*") == WORKER:
        print("Route */* already points at the Worker.")
    elif "*/*" in existing:
        sys.exit(f"Route */* exists but points at {existing['*/*'] or 'no Worker'}; change it by hand.")
    else:
        print(f"{plan} add route */* -> {WORKER}.")
        if not args.dry_run:
            cf(token, "POST", f"/zones/{zone_id}/workers/routes", {"pattern": "*/*", "script": WORKER})

    saas_on = True
    try:
        current = cf(token, "GET", f"/zones/{zone_id}/custom_hostnames/fallback_origin").get("origin")
    except CloudflareError as e:
        saas_on = "1456" not in str(e)
        current = None
        if saas_on:
            raise
    if not saas_on:
        print("Cloudflare for SaaS is off: switch it on (SSL/TLS -> Custom Hostnames), then run this again.")
    elif current == pages_host:
        print(f"Fallback origin is already {pages_host}.")
    else:
        print(f"{plan} set the fallback origin to {pages_host} (was {current or 'unset'}).")
        if not args.dry_run:
            cf(token, "PUT", f"/zones/{zone_id}/custom_hostnames/fallback_origin", {"origin": pages_host})

    if not args.dry_run:
        changed = [f"{h}: {before[h]} -> {s}" for h in keep if (s := http_status(h)) != before[h]]
        if changed:
            print("WARNING - these names answer differently now; check them:\n  " + "\n  ".join(changed))
        else:
            print(f"Checked {len(keep)} existing name(s); all answer as before.")
        print(f"{pages_host}/ answers {http_status(pages_host)} (404 is expected: no page at the root).")

    print("\nApp settings (Render craftmyfunnel-web and both Oracle VMs):")
    print(f"  CLOUDFLARE_ZONE_ID={zone_id}\n  CLOUDFLARE_ACCOUNT_ID={account_id}\n  CLOUDFLARE_KV_NAMESPACE_ID={kv['id']}")
    print(f"  LANDING_PAGES_CNAME_TARGET={pages_host}   (Render only)")
    print("  CLOUDFLARE_API_TOKEN=<a token with SSL and Certificates Edit on the zone + Workers KV Storage Edit>")


if __name__ == "__main__":
    try:
        main()
    except CloudflareError as e:
        sys.exit(f"Cloudflare API error: {e}")
