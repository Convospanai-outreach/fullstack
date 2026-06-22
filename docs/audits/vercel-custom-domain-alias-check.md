# Vercel Custom Domain Alias Check

Date: 2026-06-22
Agent: approval-readiness-agent
Status: Custom domain appears to serve the latest requested public-route/content behavior for `9788d84`; exact immutable custom-domain deployment SHA is not exposed by public response headers.

## Tested Commit

| Field | Value |
| --- | --- |
| Commit | `9788d84db4afce78964aa9da90b22d606ef988a2` |
| Branch | `origin/codex/db-linkage-swarm-orchestration` |
| Commit subject | `fix(web): stabilize cinematic hero rendering, path normalization, and studio UI build` |

## Vercel Status Evidence

GitHub commit status API for `9788d84db4afce78964aa9da90b22d606ef988a2` returned:

| Field | Value |
| --- | --- |
| Overall state | `success` |
| Status context | `Vercel` |
| Description | `Deployment has completed` |
| Created at | `2026-06-21T06:02:38Z` |
| Vercel dashboard target URL | `https://vercel.com/convo2026s-projects/fullstack-web-xkxn/Gxi6FxAWQnDmW5KMGEQNjrDWrVH2` |

GitHub deployments API for the same SHA returned deployment `5138739382`:

| Field | Value |
| --- | --- |
| Environment | `Preview` |
| Production environment | `false` |
| Status | `success` |
| Preview URL | `https://fullstack-web-xkxn-jifhkvhbk-convo2026s-projects.vercel.app` |

The preview URL returned `401 Unauthorized` from Vercel SSO, so it could not be used for public page-content comparison.

## Custom Domains Checked

| Domain | Check | Result |
| --- | --- | --- |
| `www.craftmyfunnel.live` | `GET /` over public HTTPS with SNI/TLS via `curl --resolve www.craftmyfunnel.live:443:76.76.21.21` | `200 OK`, `Server: Vercel`, page content present |
| `craftmyfunnel.live` | `HEAD /` over public HTTPS with SNI/TLS via `curl --resolve craftmyfunnel.live:443:76.76.21.21` | `308 Permanent Redirect` to `https://www.craftmyfunnel.live/` |

Local DNS caveat: this workstation resolves both custom domains to `127.0.0.1`, so checks intentionally bypassed local DNS while preserving TLS hostname verification.

## Freshness Signals

Observed on `www.craftmyfunnel.live`:

- `/funnel` exists, returns `200`, and serves a route chunk containing `app/funnel/page`.
- `/`, `/funnel`, and approval pages serve the cinematic funnel/public approval page behavior introduced by the latest requested branch head.
- `/security`, `/support`, `/data-deletion`, and `/google-api-disclosure` no longer redirect to login.
- `/terms` and `/contact` no longer contain `bizcomm.soulutions@gmail.com`, `support@craftmyfunnel.com`, or `enterprise@craftmyfunnel.com`.
- Served HTML does not contain the newer `origin/main`-only `flywheel` or `revenue chest` text/assets, which supports the conclusion that the custom domain is not serving the later local `main` head.

## Verdict

The custom domain appears to serve the latest requested `9788d84` public-route and approval-content behavior. The exact custom-domain deployment SHA could not be proven from public headers because Vercel does not expose it in the response, and the immutable preview URL for the SHA is SSO-protected.

Next action: resolve the frontend smoke/runtime risks and local validation timeouts before promoting overall status beyond `NEEDS_REPLAN`.
