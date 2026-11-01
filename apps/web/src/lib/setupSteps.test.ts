import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_RESPONSIBILITY_VERSION, hasDataResponsibilityAck, nextStepId, previousStepId, readOutreachMode, visibleStepIds } from "./setupSteps";

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

describe("setup steps by outreach mode", () => {
    it("shows every step to a company, or before the question is answered", () => {
        expect(visibleStepIds(ALL, "company")).toEqual(ALL);
        expect(visibleStepIds(ALL, null)).toEqual(ALL);
    });

    it("hides brand details, handoffs and team invites from a personal user", () => {
        expect(visibleStepIds(ALL, "personal")).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
    });

    it("moves over hidden steps and stops at the ends", () => {
        const personal = visibleStepIds(ALL, "personal");
        expect(nextStepId(personal, 1)).toBe(3);
        expect(nextStepId(personal, 10)).toBe(12);
        expect(nextStepId(personal, 12)).toBeNull();
        expect(previousStepId(personal, 3)).toBe(1);
        expect(previousStepId(personal, 12)).toBe(10);
        expect(previousStepId(personal, 1)).toBeNull();
    });

    it("reads only the two known answers from aiConfig", () => {
        expect(readOutreachMode({ outreachMode: "personal" })).toBe("personal");
        expect(readOutreachMode({ outreachMode: "company" })).toBe("company");
        expect(readOutreachMode({ outreachMode: "agency" })).toBeNull();
        expect(readOutreachMode({})).toBeNull();
        expect(readOutreachMode(null)).toBeNull();
    });
});

describe("data responsibility acknowledgement", () => {
    // The API route (apps/api/routes/setup/save) keeps the same version; both are read from this fixture.
    it("uses the version in the shared fixture", () => {
        const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../tests/fixtures/data-responsibility.json"), "utf8")) as { version: string };
        expect(DATA_RESPONSIBILITY_VERSION).toBe(fixture.version);
    });

    it("counts only an acknowledgement of the current notice version", () => {
        expect(hasDataResponsibilityAck({ dataResponsibility: { version: "2026-11", acknowledgedBy: "user-1", acknowledgedAt: "2026-11-01T10:00:00.000Z" } })).toBe(true);
        expect(hasDataResponsibilityAck({ dataResponsibility: { version: "2026-10", acknowledgedBy: "user-1", acknowledgedAt: "2026-10-01T10:00:00.000Z" } })).toBe(false);
        expect(hasDataResponsibilityAck({ outreachMode: "company" })).toBe(false);
        expect(hasDataResponsibilityAck(null)).toBe(false);
    });
});
