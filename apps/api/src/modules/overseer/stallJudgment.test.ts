import { describe, expect, it } from "vitest";

import { judgeStalledEnrollments, StallCandidate } from "./stallJudgment";

const candidate: StallCandidate = {
    enrollmentId: "enr-1",
    sequenceName: "Cold Outreach",
    stage: "step 2 of 5",
    stallDays: 6.3,
    whatsappEligible: false,
    replied: false,
    replyClassification: null
};

const judge = (overrides: Partial<StallCandidate>) => judgeStalledEnrollments([{ ...candidate, ...overrides }])[0];

describe("judgeStalledEnrollments", () => {
    it("routes a lead with no reply to manual follow-up", () => {
        expect(judge({})).toEqual(expect.objectContaining({ enrollmentId: "enr-1", nudgeType: "ROUTE_MANUAL" }));
    });

    it("suggests WhatsApp for a whatsapp-eligible lead with no reply", () => {
        expect(judge({ whatsappEligible: true })).toEqual(expect.objectContaining({ nudgeType: "TRY_WHATSAPP" }));
    });

    it.each([
        ["DNC", "LIKELY_DEAD"],
        ["NOT_INTERESTED", "LIKELY_DEAD"],
        ["INTERESTED", "ROUTE_MANUAL"],
        ["QUESTION", "ROUTE_MANUAL"],
        ["OOO", "RESEND_STEP"],
    ])("a latest reply classified %s gives %s, even when WhatsApp is available", (replyClassification, nudgeType) => {
        expect(judge({ replied: true, replyClassification, whatsappEligible: true }).nudgeType).toBe(nudgeType);
    });

    it("routes an unclassified reply to manual review", () => {
        const result = judge({ replied: true, whatsappEligible: true });
        expect(result.nudgeType).toBe("ROUTE_MANUAL");
        expect(result.suggestion).toContain("review the reply");
    });

    it("states the stall in every suggestion", () => {
        expect(judge({}).suggestion).toContain("Stalled 6.3 days at step 2 of 5");
    });

    it("returns an empty array for an empty candidate list", () => {
        expect(judgeStalledEnrollments([])).toEqual([]);
    });
});
