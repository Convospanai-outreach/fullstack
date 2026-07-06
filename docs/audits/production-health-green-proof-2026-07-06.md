# Production Health Green Proof

## Scope
Evidence-only proof that the production health route is now working after:
- PR #68: isolated health runtime/proxy boundary
- PR #70: skipped web hardware verification in Vercel/serverless runtime
- removal of the local Windows hosts override

## Important distinction
- Earlier PowerShell curl failures were caused by a local Windows hosts override mapping `craftmyfunnel.live` and `www.craftmyfunnel.live` to `127.0.0.1`.
- Those failures were local-machine false negatives, not Vercel production responses.
- Browser and corrected curl now hit Vercel.

## Evidence
- Current branch: `docs/production-health-green-proof-2026-07-06`
- Current main SHA: `e30d177eb0f0f5ec475b6da7d250097ff9421b4a`
- `Resolve-DnsName craftmyfunnel.live -Type A -Server 8.8.8.8` returned:
  - `216.198.79.65`
  - `64.29.17.65`
- `Resolve-DnsName www.craftmyfunnel.live -Type CNAME -Server 8.8.8.8` returned:
  - `d6db2f592966d5f8.vercel-dns-017.com`
- Apex redirects to www:
  - `craftmyfunnel.live/api/health?probe=live` -> `308` to `https://www.craftmyfunnel.live/api/health?probe=live`
  - `craftmyfunnel.live/api/health?probe=ready` -> `308` to `https://www.craftmyfunnel.live/api/health?probe=ready`
- `www.craftmyfunnel.live/api/health?probe=live` returns:
  - `HTTP 200`
  - JSON status `alive`
  - probe `liveness`
  - service `craftmyfunnel-web`
- `www.craftmyfunnel.live/api/health?probe=ready` returns:
  - `HTTP 200`
  - JSON status `healthy`
  - probe `readiness`
  - database `up`
- Response headers confirm Vercel:
  - `Server: Vercel`
  - `X-Vercel-Id` present
  - `X-Matched-Path: /api/health`

## Current health verdict
GREEN for:
- production liveness
- production readiness
- database connectivity via readiness probe
- Vercel domain routing

## Not included
This does not prove:
- full auth flows
- Clerk user/team creation
- Redis behavior
- complete migration drift resolution
- PR #6 safety
- full production readiness
- controlled beta readiness

## Next recommended PDCA stage
Move to read-only DB schema and migration drift proof.

## Verdict
GREEN: production health boundary verified
YELLOW: overall production readiness still pending DB/schema/auth/Redis/functional gates
