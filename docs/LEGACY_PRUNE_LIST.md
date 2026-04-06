Legacy / low-priority code and assets (do not delete yet; first confirm owners, backups, and dependencies):

- legacy/root-web-archive/** - superseded by apps/web; old UI, workers, scripts.
- legacy monolith worker pipeline - superseded by apps/api.
- orchestrator/** (Python) - pre-TypeScript orchestrator; not used by current runtime.
- services/edge-node/** - prototype edge runtime; not wired into current deployment.
- services/managed-runtime-api/** - prototype managed runtime; not in main app path.
- older Chrome extension surface - current flows are in apps/api/routes/extension/* and apps/web/src/modules/scraper-bridge/*.
- apps/web/src/vendor/pptxgenjs/** - vendored library; replace with npm dependency if still needed.
- docs/baseline/** and historical audit artifacts - keep for reference only.

Recommended next steps before removal:
- Run a repo-wide `rg` or import scan to confirm no active imports.
- Check CI/build scripts for references to the above paths.
- Archive to a `legacy` branch or tagged release before deleting.
- Update lint/test inclusion/exclusion once removals are approved.
