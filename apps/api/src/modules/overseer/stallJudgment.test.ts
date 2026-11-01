import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockJudgeThread } = vi.hoisted(() => ({ mockJudgeThread: vi.fn() }));

vi.mock("@/lib/ai/jev", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/ai/jev")>()),
    judgeStalledThread: mockJudgeThread,
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    combineStallDecision,
    judgeStalledEnrollment,
    judgeStalledEnrollments,
    judgeStalledEnrollmentsWithJev,
    stallJevFlagKeys,
    stallJevMode,
    StallCandidate,
    StallJudgment,
} from "./stallJudgment";

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

// --- Jev-judged stall decisions ---

const pick = (choice: string, p = 0.9) => {
    const rest = (1 - p) / 3;
    const probabilities = { wait: rest, nudge_now: rest, escalate_to_human: rest, stop: rest };
    probabilities[choice as keyof typeof probabilities] = p;
    return { choice: choice as keyof typeof probabilities, probabilities };
};

const answer = (overrides: { leadWaitingOnUs?: number; leadAskedToStop?: number; leadTurnedDown?: number; move?: ReturnType<typeof pick> } = {}) => ({
    leadWaitingOnUs: overrides.leadWaitingOnUs ?? 0.1,
    leadAskedToStop: overrides.leadAskedToStop ?? 0.1,
    leadTurnedDown: overrides.leadTurnedDown ?? 0.1,
    nextMove: overrides.move ?? pick("nudge_now"),
});

const automated = (nudgeType: StallJudgment["nudgeType"]): StallJudgment => ({ enrollmentId: "enr-1", nudgeType, suggestion: "rule text" });
const autoCandidate = { ...candidate, whatsappEligible: true };

describe("stallJevMode", () => {
    it.each([
        [false, false, "off"],
        [false, true, "shadow"],
        [true, false, "on"],
        [true, true, "on"],
    ])("on=%s shadow=%s gives %s", (on, shadow, mode) => {
        expect(stallJevMode({ on, shadow })).toBe(mode);
    });

    it("keys each team's switches separately", () => {
        expect(stallJevFlagKeys("team-1")).toEqual({ on: "overseer_jev_stall:team-1", shadow: "overseer_jev_stall_shadow:team-1" });
    });
});

describe("combineStallDecision: hard rules are never overridden", () => {
    it("keeps a rule's LIKELY_DEAD when Jev says wait", () => {
        const rule = judgeStalledEnrollment({ ...candidate, replied: true, replyClassification: "DNC" });
        expect(combineStallDecision(rule, answer({ move: pick("wait") }), candidate)).toEqual({ judgment: rule, changed: false });
    });

    it("keeps a manual hand-off to a rep when Jev says wait", () => {
        const rule = judgeStalledEnrollment({ ...candidate, replied: true, replyClassification: "INTERESTED" });
        expect(combineStallDecision(rule, answer({ move: pick("wait") }), candidate)).toEqual({ judgment: rule, changed: false });
    });

    it("keeps an unclassified reply's review when Jev says wait", () => {
        const rule = judgeStalledEnrollment({ ...candidate, replied: true });
        expect(combineStallDecision(rule, answer({ move: pick("wait") }), candidate).judgment).toEqual(rule);
    });

    it("does not suppress an automated nudge when the lead is waiting on us", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ leadWaitingOnUs: 0.9, move: pick("wait") }), autoCandidate)).toEqual({ judgment: rule, changed: false });
    });

    it("keeps an automated nudge when the waiting Noul is unsettled (between 0.3 and 0.7)", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ leadWaitingOnUs: 0.5, move: pick("wait") }), autoCandidate)).toEqual({ judgment: rule, changed: false });
    });
});

describe("combineStallDecision: Jev's cautious answers are honoured", () => {
    it("wait suppresses an automated nudge when the lead is not waiting on us", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ move: pick("wait") }), autoCandidate)).toEqual({ judgment: null, changed: true });
    });

    it("escalate_to_human turns an automated nudge into a manual route", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        const result = combineStallDecision(rule, answer({ move: pick("escalate_to_human") }), autoCandidate);
        expect(result.changed).toBe(true);
        expect(result.judgment).toEqual({ enrollmentId: "enr-1", nudgeType: "ROUTE_MANUAL", suggestion: expect.stringContaining("Stalled 6.3 days at step 2 of 5") });
    });

    it("stop turns an automated nudge into LIKELY_DEAD", () => {
        const rule = judgeStalledEnrollment({ ...autoCandidate, replied: true, replyClassification: "OOO" });
        const result = combineStallDecision(rule, answer({ move: pick("stop") }), autoCandidate);
        expect(result.judgment?.nudgeType).toBe("LIKELY_DEAD");
        expect(result.changed).toBe(true);
    });

    it("a stop request in the lead's latest message turns a manual route into LIKELY_DEAD", () => {
        const rule = judgeStalledEnrollment({ ...candidate, replied: true });
        const result = combineStallDecision(rule, answer({ leadAskedToStop: 0.9 }), candidate);
        expect(result.judgment?.nudgeType).toBe("LIKELY_DEAD");
        expect(result.changed).toBe(true);
    });

    it("a turn-down in the lead's latest message turns an automated nudge into LIKELY_DEAD", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ leadTurnedDown: 0.9 }), autoCandidate).judgment?.nudgeType).toBe("LIKELY_DEAD");
    });

    it("a stop signal wins over the lead waiting on us", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ leadWaitingOnUs: 0.9, leadAskedToStop: 0.9 }), autoCandidate).judgment?.nudgeType).toBe("LIKELY_DEAD");
    });
});

describe("combineStallDecision: ambiguous or confirming answers fall back to the rule", () => {
    it("a stop-request Noul between 0.3 and 0.7 leaves the rule in charge", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ leadAskedToStop: 0.69 }), autoCandidate)).toEqual({ judgment: rule, changed: false });
    });

    it("a stop-request Noul at exactly 0.7 counts as yes", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ leadAskedToStop: 0.7 }), autoCandidate).judgment?.nudgeType).toBe("LIKELY_DEAD");
    });

    it("a next-move choice whose top option is below 0.7 leaves the rule in charge", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ move: pick("wait", 0.5) }), autoCandidate)).toEqual({ judgment: rule, changed: false });
    });

    it("nudge_now confirms the rule's nudge without changing it", () => {
        const rule = judgeStalledEnrollment(autoCandidate);
        expect(combineStallDecision(rule, answer({ move: pick("nudge_now") }), autoCandidate)).toEqual({ judgment: rule, changed: false });
    });

});

describe("judgeStalledEnrollmentsWithJev", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const thread = [{ from: "us" as const, text: "SECRET THREAD TEXT" }];
    const input = (mode: "off" | "shadow" | "on", overrides: Partial<StallCandidate> = {}) => ({
        candidate: { ...autoCandidate, ...overrides },
        teamId: "team-1",
        thread,
        mode,
    });

    it("off: never asks Jev, returns the rule's judgment and logs nothing", async () => {
        const result = await judgeStalledEnrollmentsWithJev([input("off")]);

        expect(mockJudgeThread).not.toHaveBeenCalled();
        expect(result.judgments).toEqual([judgeStalledEnrollment(autoCandidate)]);
        expect(result.logs).toEqual([]);
    });

    it("shadow: asks Jev, logs both decisions, but applies the rule", async () => {
        mockJudgeThread.mockResolvedValue(answer({ move: pick("wait") }));

        const result = await judgeStalledEnrollmentsWithJev([input("shadow")]);

        expect(result.judgments).toEqual([judgeStalledEnrollment(autoCandidate)]);
        expect(result.logs).toEqual([
            expect.objectContaining({ enrollmentId: "enr-1", mode: "shadow", rule: "TRY_WHATSAPP", jevNudge: "wait", applied: "rules", final: "TRY_WHATSAPP" }),
        ]);
    });

    it("on: applies Jev's wait", async () => {
        mockJudgeThread.mockResolvedValue(answer({ move: pick("wait") }));

        const result = await judgeStalledEnrollmentsWithJev([input("on")]);

        expect(result.judgments).toEqual([]);
        expect(result.logs).toEqual([expect.objectContaining({ mode: "on", jevNudge: "wait", applied: "jev", final: null })]);
    });

    it("on: a thrown error falls back to the rule and records only the error name", async () => {
        mockJudgeThread.mockRejectedValue(new Error("SECRET provider detail"));

        const result = await judgeStalledEnrollmentsWithJev([input("on")]);

        expect(result.judgments).toEqual([judgeStalledEnrollment(autoCandidate)]);
        expect(result.logs).toEqual([expect.objectContaining({ applied: "fallback", final: "TRY_WHATSAPP", jevError: "Error" })]);
        expect(JSON.stringify(result.logs)).not.toContain("SECRET");
    });

    it("on: an unavailable Jev (no key) falls back to the rule", async () => {
        const unavailable = Object.assign(new Error("JEV_API_KEY is not set"), { name: "JevUnavailableError" });
        mockJudgeThread.mockRejectedValue(unavailable);

        const result = await judgeStalledEnrollmentsWithJev([input("on")]);

        expect(result.judgments).toEqual([judgeStalledEnrollment(autoCandidate)]);
        expect(result.logs).toEqual([expect.objectContaining({ applied: "fallback", jevError: "JevUnavailableError" })]);
    });

    it("on: a Noul in the ambiguous band leaves the rule in charge", async () => {
        mockJudgeThread.mockResolvedValue(answer({ leadAskedToStop: 0.5, move: pick("nudge_now") }));

        const result = await judgeStalledEnrollmentsWithJev([input("on")]);

        expect(result.judgments).toEqual([judgeStalledEnrollment(autoCandidate)]);
        expect(result.logs).toEqual([expect.objectContaining({ applied: "rules", final: "TRY_WHATSAPP" })]);
    });

    it("asks Jev with the candidate's own team and thread, and the quiet time", async () => {
        mockJudgeThread.mockResolvedValue(answer());

        await judgeStalledEnrollmentsWithJev([input("on", { stallDays: 6.3 })]);

        expect(mockJudgeThread).toHaveBeenCalledWith({ thread, quietForDays: 6 }, "team-1");
    });

    it("logs probabilities rounded to two decimals and never any message text", async () => {
        mockJudgeThread.mockResolvedValue({ ...answer({ move: pick("nudge_now") }), leadAskedToStop: 0.1234 });

        const result = await judgeStalledEnrollmentsWithJev([input("shadow")]);

        expect(result.logs[0].probabilities?.leadAskedToStop).toBe(0.12);
        expect(JSON.stringify(result.logs)).not.toContain("SECRET THREAD TEXT");
    });
});
