import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...parts: string[]) {
    const full = path.resolve(process.cwd(), ...parts);
    return fs.readFileSync(full, "utf8");
}
function workspacePath(...parts: string[]) {
    return path.resolve(process.cwd(), ...parts);
}

// Source-string guards (this workspace has no React render harness — vitest env
// is 'node', no @testing-library/react), mirroring landing-agent-routing-regression.test.ts.
describe("roadmap 2.12 slice 1 — duplicate ⌘K palette + dashboard error surfacing", () => {
    it("mounts only one ⌘K palette: CommandPalette is unmounted and deleted (B-10)", () => {
        const overlays = readWorkspaceFile("src", "components", "layout", "ClientOverlays.tsx");
        expect(overlays).not.toContain("CommandPalette");
        expect(fs.existsSync(workspacePath("src", "components", "ui", "CommandPalette.tsx"))).toBe(false);
    });

    it("KPIRow renders a zero delta as 0, not '— N/A' (B-11)", () => {
        const kpiRow = readWorkspaceFile("src", "components", "dashboard", "KPIRow.tsx");
        expect(kpiRow).not.toContain("N/A");
    });

    it("KPIRow has a distinct error state so an outage is not the loading skeleton (B-11)", () => {
        const kpiRow = readWorkspaceFile("src", "components", "dashboard", "KPIRow.tsx");
        expect(kpiRow).toContain("error");
        expect(kpiRow).toContain("Unavailable");
    });

    it("dashboard page surfaces a load failure instead of swallowing it (B-11)", () => {
        const page = readWorkspaceFile("src", "app", "(dashboard)", "dashboard", "page.tsx");
        expect(page).toContain("setError(true)");
        expect(page).toContain("error={error}");
    });
});
