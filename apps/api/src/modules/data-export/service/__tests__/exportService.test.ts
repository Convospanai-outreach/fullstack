import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findMany: vi.fn(),
        },
        campaign: {
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { exportService } from "../exportService";

describe("exportService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("generateCsv", () => {
        it("queries leads scoped to the team and renders CSV columns", async () => {
            (prisma.lead.findMany as any).mockResolvedValue([
                {
                    id: "lead-1",
                    fullName: "Jane Doe",
                    email: "jane@example.com",
                    company: "Acme, Inc.",
                    jobTitle: "CEO",
                    status: "NEW",
                    intentScore: 0.8,
                    createdAt: "2026-01-01T00:00:00.000Z",
                },
            ]);

            const csv = await exportService.generateCsv("leads", "team-1");

            expect(prisma.lead.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    company: true,
                    jobTitle: true,
                    status: true,
                    intentScore: true,
                    createdAt: true,
                },
            });
            expect(csv).toContain("id,fullName,email,company,jobTitle,status,intentScore,createdAt");
            // Company value contains a comma, so it must be quoted per toCsv's escaping rules
            expect(csv).toContain("\"Acme, Inc.\"");
        });

        it("queries campaigns scoped to the team when entityType is campaigns", async () => {
            (prisma.campaign.findMany as any).mockResolvedValue([
                { id: "c1", name: "Q1 Outreach", status: "active", targetCount: 100, completedCount: 40, createdAt: "2026-01-01" },
            ]);

            const csv = await exportService.generateCsv("campaigns", "team-1");

            expect(prisma.campaign.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    targetCount: true,
                    completedCount: true,
                    createdAt: true,
                },
            });
            expect(csv).toContain("Q1 Outreach");
        });

        it("returns an empty string when there are no rows", async () => {
            (prisma.lead.findMany as any).mockResolvedValue([]);

            const csv = await exportService.generateCsv("leads", "team-1");

            expect(csv).toBe("");
        });
    });

    describe("generateJson", () => {
        it("returns leads scoped to the team as JSON", async () => {
            (prisma.lead.findMany as any).mockResolvedValue([{ id: "lead-1", fullName: "Jane Doe" }]);

            const json = await exportService.generateJson("leads", "team-1");

            expect(prisma.lead.findMany).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
            expect(JSON.parse(json)).toEqual([{ id: "lead-1", fullName: "Jane Doe" }]);
        });

        it("returns campaigns scoped to the team as JSON", async () => {
            (prisma.campaign.findMany as any).mockResolvedValue([{ id: "c1", name: "Q1 Outreach" }]);

            const json = await exportService.generateJson("campaigns", "team-1");

            expect(prisma.campaign.findMany).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
            expect(JSON.parse(json)).toEqual([{ id: "c1", name: "Q1 Outreach" }]);
        });
    });
});
