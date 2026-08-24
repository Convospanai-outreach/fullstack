import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        email: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/modules/caller/CallerService", () => ({
    CallerService: {
        ensureQueueEntry: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { CallerService } from "@/modules/caller/CallerService";
import { LeadScoringService } from "../LeadScoringService";

describe("LeadScoringService", () => {
    let service: LeadScoringService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LeadScoringService();
    });

    describe("calculateIntentScore", () => {
        it("scores maxed-out engagement as HOT", async () => {
            const result = await service.calculateIntentScore({
                dwellTimeMinutes: 20,
                emailClicks: 20,
                socialMentions: 10,
            });

            expect(result.score).toBeCloseTo(1.0, 5);
            expect(result.tier).toBe("HOT");
        });

        it("scores zero engagement as COLD", async () => {
            const result = await service.calculateIntentScore({
                dwellTimeMinutes: 0,
                emailClicks: 0,
                socialMentions: 0,
            });

            expect(result.score).toBe(0);
            expect(result.tier).toBe("COLD");
        });
    });

    describe("generateExplanation", () => {
        it("builds a factor breakdown with a human-readable summary", async () => {
            const explanation = await service.generateExplanation("lead-1", {
                dwellTimeMinutes: 20,
                emailClicks: 0,
                socialMentions: 0,
            });

            expect(explanation.leadId).toBe("lead-1");
            expect(explanation.factors).toHaveLength(4);
            expect(explanation.summary).toContain("intent confidence");
        });
    });

    describe("scoreAndPersist", () => {
        it("throws when the lead doesn't exist", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue(null);

            await expect(service.scoreAndPersist("lead-1")).rejects.toThrow("Lead not found");
        });

        it("persists a low churn risk and promotes a hot lead to the caller queue", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: true,
                dwellTimeMinutes: 20,
                emailClicks: 20,
                socialMentions: 10,
                pipelineState: "COLD",
                hotAt: null,
                pipelineStateChangedAt: null,
                fullName: "Jane Doe",
                email: "jane@example.com",
                company: "Acme",
                jobTitle: "CEO",
                isEnriched: true,
                value: 10000,
            });
            (prisma.email.findMany as any).mockResolvedValue([]);
            (prisma.lead.update as any).mockResolvedValue({});

            await service.scoreAndPersist("lead-1");

            const data = (prisma.lead.update as any).mock.calls[0][0].data;
            expect(data.churnRisk).toBeCloseTo(0.08, 5);
            expect(data.pipelineState).toBe("HOT");
            expect(data.hotAt).toBeInstanceOf(Date);
            expect(CallerService.ensureQueueEntry).toHaveBeenCalledWith("lead-1");
        });

        it("derives optimal send hour from the most common email-open hour", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: true,
                dwellTimeMinutes: 5,
                emailClicks: 1,
                socialMentions: 0,
                pipelineState: "COLD",
                hotAt: null,
                pipelineStateChangedAt: null,
                fullName: null,
                email: null,
                company: null,
                jobTitle: null,
                isEnriched: false,
                value: 0,
            });
            (prisma.email.findMany as any).mockResolvedValue([
                { openedAt: new Date(2026, 0, 1, 9, 0, 0), clickedAt: null },
                { openedAt: new Date(2026, 0, 2, 9, 30, 0), clickedAt: null },
                { openedAt: new Date(2026, 0, 3, 14, 0, 0), clickedAt: null },
            ]);
            (prisma.lead.update as any).mockResolvedValue({});

            await service.scoreAndPersist("lead-1");

            const data = (prisma.lead.update as any).mock.calls[0][0].data;
            expect(data.optimalSendHour).toBe(9);
        });

        it("counts real Email.clickedAt rows as engagement even when Lead.emailClicks was never written (OPEN-68)", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: true,
                dwellTimeMinutes: 0,
                emailClicks: 0,
                socialMentions: 0,
                intentScore: 0,
                pipelineState: "COLD",
                hotAt: null,
                pipelineStateChangedAt: null,
                fullName: null,
                email: null,
                company: null,
                jobTitle: null,
                isEnriched: false,
                value: 0,
            });
            (prisma.email.findMany as any).mockResolvedValue([
                { openedAt: new Date(2026, 0, 1, 9, 0, 0), clickedAt: new Date(2026, 0, 1, 9, 5, 0) },
            ]);
            (prisma.lead.update as any).mockResolvedValue({});

            await service.scoreAndPersist("lead-1");

            const data = (prisma.lead.update as any).mock.calls[0][0].data;
            expect(data.intentScore).toBeGreaterThan(0);
        });

        it("never lowers intentScore below a prior externally-set value (OPEN-69)", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-1",
                consentObtained: true,
                dwellTimeMinutes: 0,
                emailClicks: 0,
                socialMentions: 0,
                intentScore: 0.8,
                pipelineState: "COLD",
                hotAt: null,
                pipelineStateChangedAt: null,
                fullName: null,
                email: null,
                company: null,
                jobTitle: null,
                isEnriched: false,
                value: 0,
            });
            (prisma.email.findMany as any).mockResolvedValue([]);
            (prisma.lead.update as any).mockResolvedValue({});

            await service.scoreAndPersist("lead-1");

            const data = (prisma.lead.update as any).mock.calls[0][0].data;
            expect(data.intentScore).toBe(0.8);
            expect(data.leadScore).toBe(80);
            expect(data.pipelineState).toBe("HOT");
        });
    });

    describe("batchScoreLeads", () => {
        it("aggregates tier distribution and average score across the team's leads", async () => {
            (prisma.lead.findMany as any).mockResolvedValue([
                { id: "lead-1", consentObtained: true, dwellTimeMinutes: 20, emailClicks: 20, socialMentions: 10, pipelineState: "COLD", hotAt: null, pipelineStateChangedAt: null, fullName: "A", email: "a@x.com", company: "A", jobTitle: "A", isEnriched: true, value: 10000 },
                { id: "lead-2", consentObtained: true, dwellTimeMinutes: 0, emailClicks: 0, socialMentions: 0, pipelineState: "COLD", hotAt: null, pipelineStateChangedAt: null, fullName: null, email: null, company: null, jobTitle: null, isEnriched: false, value: 0 },
            ]);
            (prisma.email.findMany as any).mockResolvedValue([]);
            (prisma.lead.update as any).mockResolvedValue({});

            const result = await service.batchScoreLeads("team-1");

            expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-1" } }));
            expect(result.totalProcessed).toBe(2);
            expect(result.successful).toBe(2);
            expect(result.tierDistribution).toEqual({ hot: 1, warm: 0, cold: 1 });
            expect(result.averageScore).toBeCloseTo(0.5, 5);
            expect(CallerService.ensureQueueEntry).toHaveBeenCalledWith("lead-1");
        });

        it("records a per-lead error and keeps processing the rest of the batch", async () => {
            (prisma.lead.findMany as any).mockResolvedValue([
                { id: "lead-1", consentObtained: true, dwellTimeMinutes: 0, emailClicks: 0, socialMentions: 0, pipelineState: "COLD", hotAt: null, pipelineStateChangedAt: null, fullName: null, email: null, company: null, jobTitle: null, isEnriched: false, value: 0 },
            ]);
            (prisma.email.findMany as any).mockResolvedValue([]);
            (prisma.lead.update as any).mockRejectedValue(new Error("db down"));

            const result = await service.batchScoreLeads("team-1");

            expect(result.successful).toBe(1);
            expect(result.errors).toEqual([{ leadId: "lead-1", error: "db down" }]);
        });
    });
});
