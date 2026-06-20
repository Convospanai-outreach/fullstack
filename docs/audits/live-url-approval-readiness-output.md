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
| Deployment | `dpl_5S2oME2vqrWV1NdKrhsKjqZNXCF7` |
| Commit | `6d012ea382ec324cdb73bcdcff9c5d00a843d795` |
| Branch | `codex/db-linkage-swarm-orchestration` |
| State | `READY` |

Proceeding condition was satisfied.

## Public Access Method

Normal local requests to `https://www.craftmyfunnel.live/*` failed because this workstation has hosts entries mapping both `craftmyfunnel.live` and `www.craftmyfunnel.live` to `127.0.0.1`.

Public DNS-over-HTTPS returned:

- `www.craftmyfunnel.live` CNAME `d6db2f592966d5f8.vercel-dns-017.com`
- A `216.198.79.65`
- A `64.29.17.65`

The verification used a read-only HTTPS checker that connected to `216.198.79.65` with SNI `www.craftmyfunnel.live`, preserving TLS certificate verification and bypassing the local hosts override. External page fetches were used to confirm rendered content and redirects.

## Results

| URL | HTTP status | Final URL | SSL works | Public without login | Approval-relevant content | Support email/domain | Broken route or redirect |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `https://www.craftmyfunnel.live/` | `200` | Same URL | Yes | Yes | Yes: CraftMyFunnel homepage, Google Workspace/Gmail mention, legal/trust footer | `support@craftmyfunnel.live` present | None |
| `https://www.craftmyfunnel.live/privacy` | `200` | Same URL | Yes | Yes | Yes: Privacy Policy, Google user data, deletion, no advertising use | `support@craftmyfunnel.live` present | None |
| `https://www.craftmyfunnel.live/terms` | `200` | Same URL | Yes | Yes | Yes: Terms & Conditions, outreach/channel usage, third-party integrations | Mismatch: `bizcomm.soulutions@gmail.com` | None |
| `https://www.craftmyfunnel.live/security` | Initial `307`; final `200` | `/login?callbackUrl=%2Fsecurity` | Yes | No | No: login page rendered instead of security page | Security page content inaccessible | Redirects to login |
| `https://www.craftmyfunnel.live/support` | Initial `307`; final `200` | `/login?callbackUrl=%2Fsupport` | Yes | No | No: login page rendered instead of support page | Support page content inaccessible | Redirects to login |
| `https://www.craftmyfunnel.live/data-deletion` | Initial `307`; final `200` | `/login?callbackUrl=%2Fdata-deletion` | Yes | No | No: login page rendered instead of data deletion page | Data deletion page content inaccessible | Redirects to login |
| `https://www.craftmyfunnel.live/google-api-disclosure` | Initial `307`; final `200` | `/login?callbackUrl=%2Fgoogle-api-disclosure` | Yes | No | No: login page rendered instead of Google API disclosure page | Google disclosure content inaccessible | Redirects to login |
| `https://www.craftmyfunnel.live/contact` | `200` | Same URL | Yes | Yes | Yes: contact form and support channels | Mismatch: `support@craftmyfunnel.com` and `enterprise@craftmyfunnel.com` | None |
| `https://www.craftmyfunnel.live/help` | `200` | Same URL | Yes | Yes | Yes: Help Center, setup/billing/import guides, support path | `support@craftmyfunnel.live` present in footer | None |
| `https://www.craftmyfunnel.live/faq` | `200` | Same URL | Yes | Yes | Yes: FAQ and footer trust/legal links | `support@craftmyfunnel.live` present in footer | None |

## Summary

URL verification result: `NEEDS_REPLAN`.

Passing public `200` URLs:

- `https://www.craftmyfunnel.live/`
- `https://www.craftmyfunnel.live/privacy`
- `https://www.craftmyfunnel.live/terms`
- `https://www.craftmyfunnel.live/contact`
- `https://www.craftmyfunnel.live/help`
- `https://www.craftmyfunnel.live/faq`

Failing required approval URLs:

- `https://www.craftmyfunnel.live/security` redirects to login.
- `https://www.craftmyfunnel.live/support` redirects to login.
- `https://www.craftmyfunnel.live/data-deletion` redirects to login.
- `https://www.craftmyfunnel.live/google-api-disclosure` redirects to login.

Domain/contact mismatches:

- `/terms` uses `bizcomm.soulutions@gmail.com`.
- `/contact` uses `support@craftmyfunnel.com` and `enterprise@craftmyfunnel.com`.

No live URL should be submitted for approval until the four login-gated approval pages are public and the support/contact domain mismatches are corrected.
