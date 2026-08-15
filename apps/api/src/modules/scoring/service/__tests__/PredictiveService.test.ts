import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { PredictiveService } from "../PredictiveService";

describe("PredictiveService", () => {
    let service: PredictiveService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PredictiveService();
    });

    describe("predictChurn", () => {
        it("throws when the lead doesn't exist", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue(null);

            await expect(service.predictChurn("lead-1")).rejects.toThrow("Lead not found");
        });

        it("scores a stale, low-intent lead as HIGH risk and persists churnRisk", async () => {
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                intentScore: 0,
                churnRisk: null,
                pipelineStateChangedAt: ninetyDaysAgo,
                hotAt: null,
                createdAt: ninetyDaysAgo,
            });
            (prisma.lead.update as any).mockResolvedValue({});

            const prediction = await service.predictChurn("lead-1");

            expect(prediction.churnProbability).toBeCloseTo(1.0, 1);
            expect(prediction.riskLevel).toBe("HIGH");
            expect(prediction.riskFactors).toContain("No recent activity");
            expect(prediction.riskFactors).toContain("Low intent signals");
            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: { churnRisk: prediction.churnProbability },
            });
        });

        it("scores a fresh, engaged lead as LOW risk", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                intentScore: 0.9,
                churnRisk: null,
                pipelineStateChangedAt: new Date(),
                hotAt: null,
                createdAt: new Date(),
            });
            (prisma.lead.update as any).mockResolvedValue({});

            const prediction = await service.predictChurn("lead-1");

            expect(prediction.riskLevel).toBe("LOW");
        });
    });

    describe("calculateOptimalSendTime", () => {
        it("falls back to the lead's existing optimalSendHour when there are no opened emails", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                emails: [],
                optimalSendHour: 15,
            });
            (prisma.lead.update as any).mockResolvedValue({});

            const result = await service.calculateOptimalSendTime("lead-1");

            expect(result.optimalHour).toBe(15);
            expect(result.confidence).toBe(0.4);
        });

        it("averages the hours emails were actually opened", async () => {
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                emails: [
                    { openedAt: new Date(2026, 0, 1, 8, 0, 0) },
                    { openedAt: new Date(2026, 0, 2, 10, 0, 0) },
                    { openedAt: new Date(2026, 0, 3, 12, 0, 0) },
                ],
                optimalSendHour: 9,
            });
            (prisma.lead.update as any).mockResolvedValue({});

            const result = await service.calculateOptimalSendTime("lead-1");

            expect(result.optimalHour).toBe(10);
            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: { optimalSendHour: 10 },
            });
        });
    });

    describe("clusterCustomers", () => {
        it("buckets leads scoped to the team into value/risk/recency clusters", async () => {
            const now = Date.now();
            (prisma.lead.findMany as any).mockResolvedValue([
                { id: "lead-1", value: 6000, intentScore: 0.9, churnRisk: 0.1, createdAt: new Date(now - 200 * 86400000), pipelineStateChangedAt: new Date(now - 1 * 86400000), hotAt: null },
                { id: "lead-2", value: 0, intentScore: 0.1, churnRisk: 0.9, createdAt: new Date(now - 200 * 86400000), pipelineStateChangedAt: new Date(now - 200 * 86400000), hotAt: null },
                { id: "lead-3", value: 0, intentScore: 0.1, churnRisk: 0.1, createdAt: new Date(now - 1 * 86400000), pipelineStateChangedAt: new Date(now - 1 * 86400000), hotAt: null },
            ]);

            const clusters = await service.clusterCustomers("team-1");

            expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-1" } }));
            const labels = clusters.map(c => c.label).sort();
            expect(labels).toEqual(["AT_RISK", "HIGH_VALUE", "NEW"]);
        });
    });

    describe("assignToCluster", () => {
        it("assigns HIGH_VALUE for a high composite score", () => {
            const result = service.assignToCluster("lead-1", { value: 1, engagement: 1, recency: 1, frequency: 1 });
            expect(result.clusterLabel).toBe("HIGH_VALUE");
        });

        it("assigns DORMANT for a low composite score with low recency", () => {
            const result = service.assignToCluster("lead-1", { value: 0, engagement: 0, recency: 0, frequency: 0 });
            expect(result.clusterLabel).toBe("DORMANT");
        });
    });
});
