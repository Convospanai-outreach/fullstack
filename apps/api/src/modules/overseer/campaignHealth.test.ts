import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaignSequence: { findMany: vi.fn() },
        overseerNudge: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { icpFindings, paceFindings, paceLimitsFor, runCampaignHealth } from "./campaignHealth";

const email = (delayDays: number, delayHours = 0) => ({ stepType: "EMAIL", delayDays, delayHours });
const NOW = new Date("2026-11-02T12:00:00Z");

describe("paceFindings", () => {
    it("is quiet for a gentle drip", () => {
        expect(paceFindings([email(0), email(3), email(4)])).toEqual([]);
    });

    it("flags emails closer than two days, and counts a non-email delay toward the gap", () => {
        expect(paceFindings([email(0), email(1)]).map((f) => f.ruleId)).toEqual(["email-gap"]);
        expect(paceFindings([email(0), { stepType: "LINKEDIN", delayDays: 1, delayHours: 0 }, email(1)])).toEqual([]);
    });

    it("flags a heavy first week, a long drip and a drip past 90 days", () => {
        const heavy = paceFindings([email(0), email(2), email(2), email(2)]).map((f) => f.ruleId);
        expect(heavy).toContain("first-week-load");
        const long = paceFindings(Array.from({ length: 7 }, (_, i) => email(i === 0 ? 0 : 20))).map((f) => f.ruleId);
        expect(long).toEqual(expect.arrayContaining(["email-count", "sequence-length"]));
    });

    it("loosens the limits for a daily-narrative campaign", () => {
        const daily = [email(0), email(1), email(1), email(1), email(1)];
        expect(paceFindings(daily).length).toBeGreaterThan(0);
        expect(paceFindings(daily, paceLimitsFor(["S3"]))).toEqual([]);
    });
});

describe("icpFindings", () => {
    const wide = { jobTitles: ["a", "b", "c", "d", "e", "f"], industries: ["x"] };

    it("warns when the funnel strategy has an ICP too wide to narrow", () => {
        expect(icpFindings({ industries: ["x"] }, ["S10"]).map((f) => f.ruleId)).toEqual(["icp-S10"]);
        expect(icpFindings({ jobTitles: ["a"], industries: ["x"], painPoints: ["p"] }, ["S10"])).toEqual([]);
    });

    it("warns when 4-3-2-1 has a multi-audience ICP, naming the counts", () => {
        const [finding] = icpFindings(wide, ["S11"]);
        expect(finding?.ruleId).toBe("icp-S11");
        expect(finding?.message).toContain("6 roles");
    });

    it("says nothing without those strategies", () => {
        expect(icpFindings(wide, [])).toEqual([]);
    });
});

describe("runCampaignHealth", () => {
    const sequence = (steps: unknown[], aiConfig: unknown = null) => ({
        id: "seq-1",
        teamId: "team-1",
        name: "Cold outreach",
        campaign: { aiConfig, icp: null },
        steps,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.overseerNudge.findMany.mockResolvedValue([]);
    });

    it("raises one advisory nudge per finding, named after the sequence", async () => {
        mockPrisma.campaignSequence.findMany.mockResolvedValue([sequence([email(0), email(1)])]);

        const result = await runCampaignHealth(NOW);

        expect(result).toEqual({ sequencesChecked: 1, nudgesCreated: 1 });
        expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                teamId: "team-1", sequenceId: "seq-1", stage: "email-gap", nudgeType: "CAMPAIGN_HEALTH", stallDays: 0,
                suggestion: expect.stringContaining("Cold outreach:"),
            }),
        });
    });

    it("does not repeat a finding that is open or was raised in the last 30 days", async () => {
        mockPrisma.campaignSequence.findMany.mockResolvedValue([sequence([email(0), email(1)])]);
        mockPrisma.overseerNudge.findMany.mockResolvedValue([
            { id: "n1", stage: "email-gap", status: "DISMISSED", createdAt: new Date(NOW.getTime() - 5 * 86400000) },
        ]);

        expect((await runCampaignHealth(NOW)).nudgesCreated).toBe(0);
    });

    it("raises it again once a dismissed one is older than 30 days", async () => {
        mockPrisma.campaignSequence.findMany.mockResolvedValue([sequence([email(0), email(1)])]);
        mockPrisma.overseerNudge.findMany.mockResolvedValue([
            { id: "n1", stage: "email-gap", status: "DISMISSED", createdAt: new Date(NOW.getTime() - 40 * 86400000) },
        ]);

        expect((await runCampaignHealth(NOW)).nudgesCreated).toBe(1);
    });

    it("closes an open nudge whose finding is fixed", async () => {
        mockPrisma.campaignSequence.findMany.mockResolvedValue([sequence([email(0), email(3)])]);
        mockPrisma.overseerNudge.findMany.mockResolvedValue([
            { id: "n1", stage: "email-gap", status: "OPEN", createdAt: new Date(NOW.getTime() - 86400000) },
        ]);

        await runCampaignHealth(NOW);

        expect(mockPrisma.overseerNudge.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["n1"] } }, data: { status: "DISMISSED" } });
        expect(mockPrisma.overseerNudge.create).not.toHaveBeenCalled();
    });

    it("applies the campaign's strategies to the limits", async () => {
        mockPrisma.campaignSequence.findMany.mockResolvedValue([
            sequence([email(0), email(1), email(1), email(1), email(1)], { strategies: ["S3"] }),
        ]);

        expect((await runCampaignHealth(NOW)).nudgesCreated).toBe(0);
    });
});
