import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...parts: string[]) {
    return fs.readFileSync(path.resolve(process.cwd(), ...parts), "utf8");
}

// Source-string guards (no React render harness in this workspace), mirroring
// landing-agent-routing-regression.test.ts.
describe("roadmap 2.12 slice 4 — first-run wizard blockers (U-01, U-03)", () => {
    const setup = () => readWorkspaceFile("src", "app", "setup", "page.tsx");

    it("wizard mailbox step no longer marks Google/Microsoft 'coming soon' and wires their OAuth connect (U-01)", () => {
        const page = setup();
        expect(page).not.toContain('label: "Google Workspace", comingSoon: true');
        expect(page).not.toContain('label: "Microsoft 365", comingSoon: true');
        expect(page).not.toContain("Microsoft 365 are coming soon");
        // The previously-dead connect handlers are now actually rendered.
        expect(page).toContain("props.onConnectGoogle");
        expect(page).toContain("props.onConnectMicrosoft");
    });

    it("wizard commercial-readiness step links to credit top-up when the balance is empty (U-03)", () => {
        const page = setup();
        expect(page).toContain('href="/credits"');
    });
});
