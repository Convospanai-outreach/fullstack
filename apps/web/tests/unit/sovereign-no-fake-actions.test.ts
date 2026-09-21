import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...parts: string[]) {
    return fs.readFileSync(path.resolve(process.cwd(), ...parts), "utf8");
}

// Source-string guard (no React render harness in this workspace — vitest env is
// 'node'), mirroring landing-agent-routing-regression.test.ts.
describe("roadmap 2.12 slice 2 — /sovereign no longer fakes success (B-13)", () => {
    it("removed the buttons that toasted success with zero API calls", () => {
        const page = readWorkspaceFile("src", "app", "(dashboard)", "sovereign", "page.tsx");
        // The two fake handlers and their misleading confirmations are gone.
        expect(page).not.toContain("handleExportAuditLogs");
        expect(page).not.toContain("handlePurgeTelemetry");
        expect(page).not.toContain("Encrypted JSON compliance archive downloaded");
        expect(page).not.toContain("Ephemeral AI completion buffers cleared");
        // No toast import remains, since nothing on the page reports a fake result.
        expect(page).not.toContain('from "sonner"');
    });
});
