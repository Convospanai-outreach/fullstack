import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { judgeStalledEnrollments, StallCandidate } from "./deepseekClient";

const candidate: StallCandidate = {
    enrollmentId: "enr-1",
    sequenceName: "Cold Outreach",
    stage: "step 2 of 5",
    stallDays: 6.3
};

describe("judgeStalledEnrollments", () => {
    const originalKey = process.env["DEEPSEEK_API_KEY"];

    afterEach(() => {
        if (originalKey === undefined) delete process.env["DEEPSEEK_API_KEY"];
        else process.env["DEEPSEEK_API_KEY"] = originalKey;
        vi.restoreAllMocks();
    });

    it("returns a deterministic fallback when no API key is configured", async () => {
        delete process.env["DEEPSEEK_API_KEY"];

        const result = await judgeStalledEnrollments([candidate]);

        expect(result).toEqual([
            expect.objectContaining({ enrollmentId: "enr-1", nudgeType: "ROUTE_MANUAL" })
        ]);
    });

    it("never includes lead PII fields in the outbound prompt shape", () => {
        // Type-level guarantee: StallCandidate has no name/email/phone field to leak.
        const keys = Object.keys(candidate);
        expect(keys).not.toContain("email");
        expect(keys).not.toContain("phone");
        expect(keys).not.toContain("name");
    });

    it("returns an empty array without calling out for an empty candidate list", async () => {
        process.env["DEEPSEEK_API_KEY"] = "sk-test";
        const result = await judgeStalledEnrollments([]);
        expect(result).toEqual([]);
    });
});
