import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        verificationLog: {
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { VerificationAgent } from "../VerificationAgent";

describe("VerificationAgent", () => {
    let agent: VerificationAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new VerificationAgent();
    });

    describe("verify", () => {
        it("throws when the lead doesn't exist", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue(null);

            await expect(agent.verify("lead-1")).rejects.toThrow("Lead not found");
        });

        it("flags NO_CONSENT as an error violation and fails verification", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: false,
                dwellTimeMinutes: 20,
                emailClicks: 20,
                socialMentions: 10,
            });
            (prisma.verificationLog.create as any).mockResolvedValue({});

            const result = await agent.verify("lead-1");

            expect(result.passed).toBe(false);
            expect(result.recommendation).toBe("REJECT");
            expect(result.violations).toEqual(
                expect.arrayContaining([expect.objectContaining({ type: "NO_CONSENT", severity: "ERROR" })])
            );
            expect(prisma.verificationLog.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ leadId: "lead-1", teamId: "team-1", passed: false }) })
            );
        });

        it("passes a consented lead whose score clears the threshold", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: true,
                dwellTimeMinutes: 20,
                emailClicks: 20,
                socialMentions: 10,
            });
            (prisma.verificationLog.create as any).mockResolvedValue({});

            const result = await agent.verify("lead-1");

            expect(result.passed).toBe(true);
            expect(result.recommendation).toBe("PROCESS");
            expect(result.violations).toEqual([]);
        });

        it("warns LOW_SCORE without rejecting when consent exists but score is below threshold", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: true,
                dwellTimeMinutes: 0,
                emailClicks: 0,
                socialMentions: 0,
            });
            (prisma.verificationLog.create as any).mockResolvedValue({});

            const result = await agent.verify("lead-1");

            expect(result.passed).toBe(false);
            expect(result.recommendation).toBe("REVIEW");
            expect(result.violations).toEqual(
                expect.arrayContaining([expect.objectContaining({ type: "LOW_SCORE", severity: "WARNING" })])
            );
        });
    });

    describe("verifyBatch", () => {
        it("splits leads into passed and failed based on per-lead verification", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({ id: "lead-1", teamId: "team-1", consentObtained: true, dwellTimeMinutes: 20, emailClicks: 20, socialMentions: 10 })
                .mockResolvedValueOnce({ id: "lead-2", teamId: "team-1", consentObtained: false, dwellTimeMinutes: 0, emailClicks: 0, socialMentions: 0 });
            (prisma.verificationLog.create as any).mockResolvedValue({});

            const result = await agent.verifyBatch(["lead-1", "lead-2"]);

            expect(result.passed).toHaveLength(1);
            expect(result.failed).toHaveLength(1);
            expect(result.stats.total).toBe(2);
            expect(result.stats.passRate).toBeCloseTo(0.5, 5);
        });
    });

    describe("purgeLeadData", () => {
        it("clears scoring fields and deletes verification logs for the lead", async () => {
            (prisma.lead.update as any).mockResolvedValue({});
            (prisma.verificationLog.deleteMany as any).mockResolvedValue({ count: 2 });

            const result = await agent.purgeLeadData("lead-1");

            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: {
                    intentScore: 0,
                    churnRisk: null,
                    clusterLabel: null,
                    optimalSendHour: null,
                    lastScoredAt: null,
                },
            });
            expect(prisma.verificationLog.deleteMany).toHaveBeenCalledWith({ where: { leadId: "lead-1" } });
            expect(result.success).toBe(true);
        });
    });
});
