import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...parts: string[]) {
    return fs.readFileSync(path.resolve(process.cwd(), ...parts), "utf8");
}
function workspacePath(...parts: string[]) {
    return path.resolve(process.cwd(), ...parts);
}

// Source-string guards for the parts the CI gate (tests/unit) can see. The
// behavioural routing test lives colocated at src/app/api/campaigns/[id]/start/
// route.test.ts (the [id] bracket dir keeps route tests colocated, like the
// existing run/enroll tests); it is exercised by the full workspace run.
describe("roadmap 2.12 slice 3 — unified campaign start (B-12)", () => {
    it("added the unified /start endpoint backed by the shared enrollment service", () => {
        expect(fs.existsSync(workspacePath("src", "app", "api", "campaigns", "[id]", "start", "route.ts"))).toBe(true);
        const start = readWorkspaceFile("src", "app", "api", "campaigns", "[id]", "start", "route.ts");
        expect(start).toContain("enrollCampaignLeads");
        expect(start).toContain("handleCampaignExecution");
    });

    it("routes enrollment through the shared service (no duplicated inline logic)", () => {
        const enroll = readWorkspaceFile("src", "app", "api", "campaigns", "[id]", "sequence", "enroll", "route.ts");
        expect(enroll).toContain("enrollCampaignLeads");
    });

    it("campaign page starts via /start and no longer fire-and-forgets /run with a swallowed warning", () => {
        const page = readWorkspaceFile("src", "app", "(dashboard)", "campaigns", "[id]", "page.tsx");
        expect(page).toContain("/start");
        expect(page).toContain("handleStart");
        // The silent no-op the finding cited is gone.
        expect(page).not.toContain("Campaign run endpoint warning");
    });

    it("Resume/status changes no longer trigger the /run send path", () => {
        const page = readWorkspaceFile("src", "app", "(dashboard)", "campaigns", "[id]", "page.tsx");
        // The only send trigger is now handleStart -> /start; the legacy /run
        // fire-and-forget (which Resume also hit) is gone entirely.
        expect(page).not.toContain("/run");
    });
});
