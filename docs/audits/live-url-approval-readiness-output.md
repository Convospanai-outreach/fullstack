# Live URL Approval Readiness Output

Date: 2026-06-22
Agent: approval-readiness-agent
Status: PASS for public approval URL gate; overall workflow remains NEEDS_REPLAN due frontend smoke and local validation gaps.

## Tested Commit

| Field | Value |
| --- | --- |
| Commit | `9788d84db4afce78964aa9da90b22d606ef988a2` |
| Branch | `origin/codex/db-linkage-swarm-orchestration` |
| Commit subject | `fix(web): stabilize cinematic hero rendering, path normalization, and studio UI build` |

## Public Access Method

Local DNS for both `www.craftmyfunnel.live` and `craftmyfunnel.live` resolves to `127.0.0.1` on this workstation, so direct local requests would not be valid public-internet evidence.

Verification used public HTTPS with SNI/TLS verification and `curl --resolve www.craftmyfunnel.live:443:76.76.21.21` to bypass the local DNS override while still requesting the real public host.

## Results

| URL | Initial HTTP status | Final HTTP status after redirects | Final URL | Redirects to `/login` | Public without authentication | Expected page content present | `support@craftmyfunnel.live` present where expected | `bizcomm.soulutions@gmail.com` present | `support@craftmyfunnel.com` present | `enterprise@craftmyfunnel.com` present |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `https://www.craftmyfunnel.live/` | `200` | `200` | `https://www.craftmyfunnel.live/` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/security` | `200` | `200` | `https://www.craftmyfunnel.live/security` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/support` | `200` | `200` | `https://www.craftmyfunnel.live/support` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/data-deletion` | `200` | `200` | `https://www.craftmyfunnel.live/data-deletion` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/google-api-disclosure` | `200` | `200` | `https://www.craftmyfunnel.live/google-api-disclosure` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/terms` | `200` | `200` | `https://www.craftmyfunnel.live/terms` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/contact` | `200` | `200` | `https://www.craftmyfunnel.live/contact` | No | Yes | Yes | Yes | No | No | No |
| `https://www.craftmyfunnel.live/funnel` | `200` | `200` | `https://www.craftmyfunnel.live/funnel` | No | Yes | Yes | Yes | No | No | No |

## Interpretation

- The stale 2026-06-20 failure is no longer reproduced for the required approval URLs.
- `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` are now public and no longer redirect to `/login`.
- `/terms` and `/contact` no longer expose the old email values checked here.
- The approval URL gate itself is suitable for the next review stage, subject to the separate frontend smoke and validation findings in `docs/audits/frontend-production-smoke-output.md`.

## Validation Commands

| Command | Result |
| --- | --- |
| `npm run lint --workspace apps/web` | Timed out after 180s; not counted as pass |
| `npm run typecheck --workspace apps/web` | Passed |
| `npm run build --workspace apps/web` | Timed out after 600s; not counted as pass |

No DB, Prisma schema, migration, unsafe EdgeNode migration, OAuth scope, Chrome extension permission, automation behavior, production DB, or PR #6 work was performed.
