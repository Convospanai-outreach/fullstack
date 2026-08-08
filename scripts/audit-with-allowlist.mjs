#!/usr/bin/env node
// Runs `npm audit` and fails only on high/critical findings that aren't explicitly
// allowlisted below. Each entry requires a justification and a link back to
// OPEN_ITEMS.md so the exception stays visible and reviewable.
import { execSync } from "node:child_process";

const ALLOWLIST = new Map([
    [
        "GHSA-w3rx-r6r6-pgpr",
        "image-size (via pptxgenjs): ICNS parser DoS. No patched version exists " +
        "(advisory range <=2.0.2 covers every release). apps/web only ever passes " +
        "a synthetic, in-process SVG string to pptxgenjs.addImage() " +
        "(apps/web/src/modules/studio/presentationDeck.ts) - never an ICNS file, " +
        "never user-supplied input. See OPEN_ITEMS.md OPEN-13.",
    ],
    [
        "GHSA-5p2g-fcmc-qvqq",
        "image-size (via pptxgenjs): JXL/HEIF parser DoS. Same package, same " +
        "unpatched advisory range, same non-exploitable usage as GHSA-w3rx-r6r6-pgpr " +
        "above. See OPEN_ITEMS.md OPEN-13.",
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
