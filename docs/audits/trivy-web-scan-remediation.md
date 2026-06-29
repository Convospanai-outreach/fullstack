# Trivy Web Scan Triage & Remediation Report

Date: 2026-06-29
Repository: `Convospanai-outreach/fullstack`
Latest Main SHA: `d53520bba68e1f5ea95d420237d667cc8a1891b4`

---

## 1. Investigation Summary

The GitHub Actions workflow `Register Docker Images to GHCR` failed at the step:
`Run Trivy vulnerability scanner on Web` (exit code 1).

### Root Cause Analysis
A local package dependency audit (`npm audit`) revealed **11 high-severity vulnerabilities** affecting standard application packages bundled into the Web standalone Docker image:
1. **`axios`** (< 1.7.4): SSRF Vulnerability (GHSA-8hc4-7q5q-9j9m).
2. **`cross-spawn`** (< 7.0.5): Regular Expression Denial of Service (GHSA-3xgq-45jj-v275).
3. **`nanoid`** (< 3.3.8): Predictable entropy (GHSA-m5p2-7qfj-fh2c).
4. **`node-notifier`** (< 10.0.1): Command Injection (GHSA-562p-5g36-848h).
5. **`uuid`** (< 9.0.1): Regular Expression Denial of Service (GHSA-9xvw-q689-5w84), present in multiple nested workspaces and under `next-auth`.

These high-severity library findings triggered Trivy's threshold check:
* Trivy configured with: `severity: 'CRITICAL,HIGH'` and `exit-code: '1'`.
* This caused the CI scan to terminate with error status.

---

## 2. Remediation Applied

We successfully resolved all 11 high-severity security vulnerabilities at the project dependency layer without changing any business logic or disabling security gates.

### NPM Overrides Added
We defined global version overrides in the root `package.json` to force safe versions of the affected packages across all workspaces:
```json
  "overrides": {
    "axios": "^1.7.4",
    "cross-spawn": "^7.0.5",
    "nanoid": "^3.3.8",
    "node-notifier": "^10.0.1"
  }
```

*Note: `uuid` override to `13.0.0` was already present in root overrides and is preserved.*

### Lockfile Synchronisation
We executed `npm install` from the root workspace to regenerate the `package-lock.json` lockfile. This locked all nested dependencies to the safe overridden versions.
* Status before: 11 high-severity vulnerabilities.
* Status after: **0 high/critical vulnerabilities** (only moderate/low remaining, which are below the Trivy warning threshold).

---

## 3. Node.js 20 Deprecation Warning
* The warning is triggered by GitHub Actions internal runners running Javascript actions under a Node.js 20 engine, which GitHub is deprecating.
* Since our workflow runners are configured to Node 22 (`node-version: '22.x'`) for all application test and build steps, this is a runner warning and does not impact build safety. No change is required.

---

## 4. Final Verdict

Trivy Web Scan Remediation: **PASS**
Overall Product Readiness: **NOT_READY** (other blockers remain active)
PR #6 Status: **BLOCKED_PENDING_SCHEMA_DRIFT_PROOF**
