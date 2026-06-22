# Local Validation Output

Date: 2026-06-22
Agent: approval-readiness-agent
Commit under validation: local branch after auth/session public-page fix

## Commands

| Command | Duration | Exit code | Result |
| --- | ---: | ---: | --- |
| `npm run typecheck --workspace apps/web` | 212.4s | 0 | PASS |
| `npm run lint --workspace apps/web` | 182.3s | 0 | PASS with one warning |
| `npm run build --workspace apps/web` | 805.2s | 0 | PASS |

## Lint Warning

`apps/web/src/lib/useLenis.ts` reported one existing warning:

`98:3 warning Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')`

No lint errors were reported.

## Build Notes

The build completed successfully but is slow. Earlier 180s/600s failures were timeouts, not command failures.

The build also emitted non-blocking warnings:

- `npm warn Unknown env config "tmp". This will stop working in the next major version of npm.`
- Browserslist/caniuse-lite data is 6 months old.

## Targeted After-Fix Runtime Check

After build, a local production server was started on port `3010`. Chromium verified `/security`, `/support`, `/data-deletion`, `/google-api-disclosure`, and `/funnel` returned `200`, made zero `/api/auth/session` browser requests, and emitted no NextAuth console errors.

## Next Action

Keep generous local validation timeouts for this workspace. A 15-minute build timeout is more realistic than 10 minutes for `apps/web` on this machine.
