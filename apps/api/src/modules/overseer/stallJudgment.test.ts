import { describe, expect, it } from "vitest";

import { judgeStalledEnrollment, judgeStalledEnrollments, StallCandidate } from "./stallJudgment";

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

// Characterization: the exact rule outputs (type and suggestion text) that flag-off behaviour must keep.
describe("current rule outputs (characterization)", () => {
    const rule = (overrides: Partial<StallCandidate>) => judgeStalledEnrollment({ ...candidate, ...overrides });

    it.each([
        [{}, "ROUTE_MANUAL", "Stalled 6.3 days at step 2 of 5 with no reply and no recorded next step - flagged for manual follow-up."],
        [{ whatsappEligible: true }, "TRY_WHATSAPP", "Stalled 6.3 days at step 2 of 5 on email alone - this lead has WhatsApp available and consented, so a personal WhatsApp check-in may re-engage them."],
        [{ replied: true, replyClassification: "DNC" }, "LIKELY_DEAD", "Stalled 6.3 days at step 2 of 5. The lead's latest reply asks not to be contacted again - consider ending this enrollment."],
        [{ replied: true, replyClassification: "NOT_INTERESTED" }, "LIKELY_DEAD", "Stalled 6.3 days at step 2 of 5. The lead's latest reply turned the offer down - consider ending this enrollment."],
        [{ replied: true, replyClassification: "INTERESTED" }, "ROUTE_MANUAL", "Stalled 6.3 days at step 2 of 5. The lead replied with interest and nothing is scheduled - a rep should answer."],
        [{ replied: true, replyClassification: "QUESTION" }, "ROUTE_MANUAL", "Stalled 6.3 days at step 2 of 5. The lead replied with a question and nothing is scheduled - a rep should answer."],
        [{ replied: true, replyClassification: "OOO" }, "RESEND_STEP", "Stalled 6.3 days at step 2 of 5. The lead's latest reply was an away message - resend this step once they are back."],
        [{ replied: true }, "ROUTE_MANUAL", "Stalled 6.3 days at step 2 of 5. The lead replied and nothing is scheduled - review the reply."],
    ])("keeps the rule output for %o", (overrides, nudgeType, suggestion) => {
        expect(rule(overrides)).toEqual({ enrollmentId: "enr-1", nudgeType, suggestion });
    });
});
