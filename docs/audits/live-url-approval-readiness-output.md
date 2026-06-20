# Live URL Approval Readiness Output

Date: 2026-06-20
Agent: approval-readiness-agent
Status: NEEDS_REPLAN

## Vercel Gate

Vercel was checked before URL verification.

| Field | Value |
| --- | --- |
| Project | `fullstack-web-xkxn` |
| Project ID | `prj_CaGvMj7pnHTCMTp3iPTsYHCHSdf8` |
| Team | `team_ju8AaZfJ8hE4jmsMW0tTnAJ5` |
| Deployment | `dpl_J8U8CjWQtgZV74erY8Mhg3teYjCW` |
| Commit | `74423bcb39184754a13f7cc43d4f9c3ebe2a70ec` |
| Branch | `codex/db-linkage-swarm-orchestration` |
| State | `READY` |

Proceeding condition was satisfied.

## Public Access Method

Normal local requests to `https://www.craftmyfunnel.live/*` fail on this workstation because hosts entries map both `craftmyfunnel.live` and `www.craftmyfunnel.live` to `127.0.0.1`.

Public DNS-over-HTTPS returned:

- `www.craftmyfunnel.live` CNAME `d6db2f592966d5f8.vercel-dns-017.com`
- A `216.198.79.65`
- A `64.29.17.65`

The verification used a read-only HTTPS checker that connected to `216.198.79.65` with SNI `www.craftmyfunnel.live`, preserving TLS certificate verification while bypassing the local hosts override.

## Results

| URL | Initial HTTP status | Final HTTP status | Final URL | Redirects to `/login` | Public without authentication | SSL works | Approval-relevant content present | `support@craftmyfunnel.live` appears | Old email search result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `https://www.craftmyfunnel.live/security` | `307` | `200` | `https://www.craftmyfunnel.live/login?callbackUrl=%2Fsecurity` | Yes | No | Yes | No: final page is sign-in, not security content | No | none |
| `https://www.craftmyfunnel.live/support` | `307` | `200` | `https://www.craftmyfunnel.live/login?callbackUrl=%2Fsupport` | Yes | No | Yes | No: final page is sign-in, not support content | No | none |
| `https://www.craftmyfunnel.live/data-deletion` | `307` | `200` | `https://www.craftmyfunnel.live/login?callbackUrl=%2Fdata-deletion` | Yes | No | Yes | No: final page is sign-in, not data deletion content | No | none |
| `https://www.craftmyfunnel.live/google-api-disclosure` | `307` | `200` | `https://www.craftmyfunnel.live/login?callbackUrl=%2Fgoogle-api-disclosure` | Yes | No | Yes | No: final page is sign-in, not Google API disclosure content | No | none |
| `https://www.craftmyfunnel.live/terms` | `200` | `200` | `https://www.craftmyfunnel.live/terms` | No | Yes | Yes | Yes: Terms & Conditions content is present | No | `bizcomm.soulutions@gmail.com` |
| `https://www.craftmyfunnel.live/contact` | `200` | `200` | `https://www.craftmyfunnel.live/contact` | No | Yes | Yes | Yes: contact form and support channel content is present | No | `support@craftmyfunnel.com`, `enterprise@craftmyfunnel.com` |

## Interpretation

- Vercel is `READY` for commit `74423bcb39184754a13f7cc43d4f9c3ebe2a70ec`.
- The live custom domain still behaves like the pre-fix site:
  - `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` still redirect to login.
  - `/terms` still serves `bizcomm.soulutions@gmail.com`.
  - `/contact` still serves `support@craftmyfunnel.com` and `enterprise@craftmyfunnel.com`.
- Because the public custom domain does not reflect the expected post-fix behavior/content, approval readiness remains `NEEDS_REPLAN`.

## Validation Commands

| Command | Result |
| --- | --- |
| `npm run lint --workspace apps/web` | Timed out after 120s |
| `npm run typecheck --workspace apps/web` | Timed out after 180s |
| `npm run build --workspace apps/web` | Timed out after 240s |

No live approval URL should be submitted for Google OAuth or Chrome Web Store review until the public custom domain serves the expected public pages and `support@craftmyfunnel.live` replaces all old email addresses.
