#!/usr/bin/env node
// Runs `npm audit` and fails only on high/critical findings that aren't explicitly
// allowlisted below. Each entry requires a justification and a link back to
// OPEN_ITEMS.md so the exception stays visible and reviewable.
import { execSync } from "node:child_process";

const ALLOWLIST = new Map([
    [
        "GHSA-w3rx-r6r6-pgpr",
        "image-size (via pptxgenjs): ICNS parser DoS. Fixed in image-size 2.0.3, " +
        "but pptxgenjs@4.0.1 (latest) depends on ^1.2.1 and a root override does " +
        "not apply (same conflicting-override-sets problem as OPEN-40). pptxgenjs " +
        "never loads image-size: its only call site is commented out in its " +
        "bundle. apps/web only passes a synthetic, in-process SVG string to " +
        "pptxgenjs.addImage() (apps/web/src/modules/studio/presentationDeck.ts). " +
        "See OPEN_ITEMS.md OPEN-13 and OPEN-351.",
    ],
    [
        "GHSA-5p2g-fcmc-qvqq",
        "image-size (via pptxgenjs): JXL/HEIF parser DoS. Same package, same " +
        "pptxgenjs pin and same never-loaded usage as GHSA-w3rx-r6r6-pgpr above. " +
        "See OPEN_ITEMS.md OPEN-13 and OPEN-351.",
    ],
    [
        "GHSA-5jgf-p345-68v8",
        "fast-uri (via fastify -> @fastify/ajv-compiler/fast-json-stringify -> " +
        "ajv, 3.0.0-3.1.5): host-confusion via skipped IDN canonicalization on " +
        "scheme-relative references. The vulnerable code path is ajv's URI-" +
        "format validators, only invoked when a fastify route schema declares " +
        "format: \"uri\"/\"uri-reference\" - confirmed via repo-wide search that " +
        "no route in this app declares any JSON-schema `format` keyword at " +
        "all (fastify request/response schema validation isn't used here), so " +
        "the parser never runs against attacker-controlled input. Pinning the " +
        "root override to a patched fast-uri conflicts with the existing " +
        "per-workspace overrides in apps/api and apps/web package.json (same " +
        "\"Conflicting override sets\" failure class as OPEN-40 - confirmed via " +
        "`npm install --loglevel silly`, the pin silently doesn't apply). See " +
        "OPEN_ITEMS.md OPEN-125.",
    ],
    [
        "GHSA-f65p-4m7j-42xc",
        "fast-uri: SSRF via malformed IPv6 normalization. Same unreachable " +
        "dependency chain and override conflict as GHSA-5jgf-p345-68v8 above. " +
        "See OPEN_ITEMS.md OPEN-125.",
    ],
    [
        "GHSA-fph4-wmhf-6fwf",
        "fast-uri: SSRF via repeated hostname percent-decoding. Same " +
        "unreachable dependency chain and override conflict as " +
        "GHSA-5jgf-p345-68v8 above. See OPEN_ITEMS.md OPEN-125.",
    ],
    [
        "GHSA-jqff-g426-hqxp",
        "fast-uri: host confusion via percent-encoded scheme normalization. " +
        "Same unreachable dependency chain and override conflict as " +
        "GHSA-5jgf-p345-68v8 above. See OPEN_ITEMS.md OPEN-125.",
    ],
    [
        "GHSA-5qjj-4xww-7phc",
        "valibot (via prisma -> @prisma/dev, <=1.4.1): record() issue paths can " +
        "make flatten() throw for inherited Object property names. Confirmed no " +
        "app source imports valibot directly - bundled solely by Prisma Studio's " +
        "dev tooling, never invoked by the running api/web server processes. See " +
        "OPEN_ITEMS.md OPEN-125.",
    ],
]);

function runAudit() {
    try {
        return execSync("npm audit --audit-level=high --omit=dev --json", {
            encoding: "utf8",
        });
    } catch (error) {
        if (typeof error.stdout === "string" && error.stdout.length > 0) {
            return error.stdout;
        }
        throw error;
    }
}

const report = JSON.parse(runAudit());
const foundIds = new Set(
    Object.values(report.vulnerabilities ?? {}).flatMap((vuln) =>
        (vuln.via ?? [])
            .filter((via) => typeof via === "object" && via.url)
            .map((via) => via.url.split("/").pop()),
    ),
);

const unallowed = [...foundIds].filter((id) => !ALLOWLIST.has(id));

if (unallowed.length > 0) {
    console.error(`npm audit found advisories not in the allowlist: ${unallowed.join(", ")}`);
    console.error("Run `npm audit --audit-level=high --omit=dev` for details.");
    process.exit(1);
}

if (foundIds.size > 0) {
    console.log("npm audit: all high/critical findings are allowlisted:");
    for (const id of foundIds) {
        console.log(`  - ${id}: ${ALLOWLIST.get(id)}`);
    }
} else {
    console.log("npm audit: no high/critical vulnerabilities found.");
}
