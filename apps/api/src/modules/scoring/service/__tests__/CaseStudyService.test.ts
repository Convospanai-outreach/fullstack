import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        caseStudy: {
            create: vi.fn(),
            findMany: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { CaseStudyService } from "../CaseStudyService";

describe("CaseStudyService", () => {
    let service: CaseStudyService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new CaseStudyService();
    });

    describe("ingestCaseStudy", () => {
        it("creates a case study scoped to the team", async () => {
            (prisma.caseStudy.create as any).mockResolvedValue({ id: "cs-1" });

            await service.ingestCaseStudy(
                { title: "Acme", industry: "SaaS", summary: "Grew 3x", content: "Full story", metrics: { roi: 3 } },
                "team-1"
            );

            expect(prisma.caseStudy.create).toHaveBeenCalledWith({
                data: {
                    title: "Acme",
                    industry: "SaaS",
                    summary: "Grew 3x",
                    content: "Full story",
                    metrics: { roi: 3 },
                    teamId: "team-1",
                },
            });
        });
    });

    describe("retrieveRelevantCaseStudies", () => {
        it("searches title/summary/content/industry scoped to the team", async () => {
            (prisma.caseStudy.findMany as any).mockResolvedValue([
                { id: "cs-1", title: "Acme", industry: "SaaS", summary: "Grew 3x", metrics: { roi: 3 } },
            ]);

            const results = await service.retrieveRelevantCaseStudies("growth", "team-1", 5);

            expect(prisma.caseStudy.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ teamId: "team-1" }),
                    take: 5,
                })
            );
            expect(results).toEqual([
                { id: "cs-1", title: "Acme", industry: "SaaS", summary: "Grew 3x", metrics: { roi: 3 }, similarity: 0.7 },
            ]);
        });

        it("defaults missing metrics to an empty object", async () => {
            (prisma.caseStudy.findMany as any).mockResolvedValue([
                { id: "cs-1", title: "Acme", industry: "SaaS", summary: "Grew 3x", metrics: null },
            ]);

            const results = await service.retrieveRelevantCaseStudies("growth", "team-1");

            expect(results[0].metrics).toEqual({});
        });
    });

    describe("generateRAGEnhancedCopy", () => {
        it("grounds generated copy in retrieved case studies", async () => {
            (prisma.caseStudy.findMany as any).mockResolvedValue([
                { id: "cs-1", title: "Acme", industry: "SaaS", summary: "Grew 3x", metrics: {} },
            ]);

            const result = await service.generateRAGEnhancedCopy("SaaS lead", "cold outreach", "team-1");

            expect(result.copy).toContain("Acme: Grew 3x");
            expect(result.usedCaseStudies).toHaveLength(1);
            expect(result.confidence).toBe(0.7);
            expect(result.groundedClaims).toEqual(["Grew 3x"]);
        });

        it("lowers confidence when no case studies match", async () => {
            (prisma.caseStudy.findMany as any).mockResolvedValue([]);

            const result = await service.generateRAGEnhancedCopy("unmatched", "cold outreach", "team-1");

            expect(result.confidence).toBe(0.4);
            expect(result.usedCaseStudies).toEqual([]);
        });
    });

    describe("deleteCaseStudy", () => {
        it("returns true only when a row scoped to the team was actually deleted", async () => {
            (prisma.caseStudy.deleteMany as any).mockResolvedValue({ count: 1 });

            const deleted = await service.deleteCaseStudy("cs-1", "team-1");

            expect(prisma.caseStudy.deleteMany).toHaveBeenCalledWith({ where: { id: "cs-1", teamId: "team-1" } });
            expect(deleted).toBe(true);
        });

        it("returns false when nothing matched", async () => {
            (prisma.caseStudy.deleteMany as any).mockResolvedValue({ count: 0 });

            const deleted = await service.deleteCaseStudy("cs-1", "team-1");

            expect(deleted).toBe(false);
        });
    });

    describe("listCaseStudies", () => {
        it("lists case studies scoped to the team, most recently updated first", async () => {
            (prisma.caseStudy.findMany as any).mockResolvedValue([{ id: "cs-1" }]);

            const items = await service.listCaseStudies("team-1");

            expect(prisma.caseStudy.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                orderBy: { updatedAt: "desc" },
            });
            expect(items).toEqual([{ id: "cs-1" }]);
        });
    });
});
