import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockJudge } = vi.hoisted(() => ({
    mockDb: { auditLog: { findFirst: vi.fn(), create: vi.fn() } },
    mockJudge: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/ai/jev", () => ({ NOUL_YES: 0.7, judgeEngagement: mockJudge }));

import { buildEngagementFacts, gateStagePromotion } from "../engagementGate";

const facts = { emailsSent: 3, emailClicks: 2, fastestClickSeconds: 4000, dwellTimeMinutes: 6, socialMentions: 0, daysSinceFirstEmail: 5, stage: "COLD" };
const base = { leadId: "lead-1", teamId: "team-1", currentState: "COLD", candidate: "HOT" as string | null, facts };

describe("gateStagePromotion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.auditLog.findFirst.mockResolvedValue(null);
        mockJudge.mockResolvedValue({ genuineInterest: 0.9, likelyAutomated: 0.1 });
    });

    it("moves a lead only one stage, even when the score proposes HOT", async () => {
        expect(await gateStagePromotion(base)).toBe("WARM");
        expect(await gateStagePromotion({ ...base, currentState: "WARM" })).toBe("HOT");
    });

    it("does not ask Jev when the score proposes nothing or the lead is already past WARM", async () => {
        expect(await gateStagePromotion({ ...base, candidate: null })).toBeNull();
        expect(await gateStagePromotion({ ...base, currentState: "HOT" })).toBeNull();
        expect(await gateStagePromotion({ ...base, currentState: "COORDINATING" })).toBeNull();
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("sends Jev only counts and the stage, never any personal data", async () => {
        await gateStagePromotion(base);

        expect(mockJudge).toHaveBeenCalledWith(facts, "team-1");
        expect(Object.keys(mockJudge.mock.calls[0][0]).sort()).toEqual(
            ["daysSinceFirstEmail", "dwellTimeMinutes", "emailClicks", "emailsSent", "fastestClickSeconds", "socialMentions", "stage"]
        );
    });

    it.each([
        ["too little genuine interest", { genuineInterest: 0.5, likelyAutomated: 0.1 }],
        ["clicks that look automated", { genuineInterest: 0.9, likelyAutomated: 0.8 }],
    ])("does not promote on %s", async (_label, judgment) => {
        mockJudge.mockResolvedValue(judgment);

        expect(await gateStagePromotion(base)).toBeNull();
    });

    it("records each judgment so it can be reviewed and reused", async () => {
        await gateStagePromotion(base);

        expect(mockDb.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                orgId: "team-1",
                action: "ENGAGEMENT_JUDGED",
                entity: "lead",
                entityId: "lead-1",
                metadata: expect.objectContaining({ interested: true, genuineInterest: 0.9, likelyAutomated: 0.1, hash: expect.any(String) }),
            }),
        });
    });

    it("reuses the stored judgment when the facts have not changed, without a second Jev call", async () => {
        await gateStagePromotion(base);
        const stored = mockDb.auditLog.create.mock.calls[0][0].data.metadata;
        mockDb.auditLog.findFirst.mockResolvedValue({ metadata: stored });
        mockJudge.mockClear();

        // Only the day count differs, as it does on every re-score: still the same facts.
        expect(await gateStagePromotion({ ...base, facts: { ...facts, daysSinceFirstEmail: 6 } })).toBe("WARM");
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("reuses a stored 'not interested' judgment as a block", async () => {
        mockJudge.mockResolvedValue({ genuineInterest: 0.2, likelyAutomated: 0.9 });
        await gateStagePromotion(base);
        mockDb.auditLog.findFirst.mockResolvedValue({ metadata: mockDb.auditLog.create.mock.calls[0][0].data.metadata });
        mockJudge.mockClear();

        expect(await gateStagePromotion(base)).toBeNull();
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("judges again when the behaviour changes", async () => {
        await gateStagePromotion(base);
        mockDb.auditLog.findFirst.mockResolvedValue({ metadata: mockDb.auditLog.create.mock.calls[0][0].data.metadata });
        mockJudge.mockClear();

        await gateStagePromotion({ ...base, facts: { ...facts, emailClicks: 5 } });

        expect(mockJudge).toHaveBeenCalledTimes(1);
    });

    it("leaves the lead where it is when Jev cannot answer (no answer is not a yes)", async () => {
        mockJudge.mockRejectedValue(new Error("JEV_API_KEY is not set"));

        expect(await gateStagePromotion(base)).toBeNull();
        expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it("does not promote when the judgment cannot be recorded", async () => {
        mockDb.auditLog.create.mockRejectedValue(new Error("db down"));

        expect(await gateStagePromotion(base)).toBeNull();
    });
});

describe("buildEngagementFacts", () => {
    const now = new Date("2026-11-19T00:00:00.000Z");
    const sent = new Date("2026-11-14T00:00:00.000Z");

    it("summarises behaviour as counts: fastest click, emails sent and days in touch", () => {
        const result = buildEngagementFacts(
            { dwellTimeMinutes: 6, socialMentions: 1, pipelineState: "WARM" },
            [
                { createdAt: sent, clickedAt: new Date(sent.getTime() + 3000) },
                { createdAt: new Date(sent.getTime() + 86_400_000), clickedAt: null },
            ],
            2,
            now
        );

        expect(result).toEqual({ emailsSent: 2, emailClicks: 2, fastestClickSeconds: 3, dwellTimeMinutes: 6, socialMentions: 1, daysSinceFirstEmail: 5, stage: "WARM" });
    });

    it("handles a lead with no emails and no stage", () => {
        const result = buildEngagementFacts({}, [], 0, now);

        expect(result).toEqual({ emailsSent: 0, emailClicks: 0, fastestClickSeconds: null, dwellTimeMinutes: 0, socialMentions: 0, daysSinceFirstEmail: null, stage: "COLD" });
    });
});
