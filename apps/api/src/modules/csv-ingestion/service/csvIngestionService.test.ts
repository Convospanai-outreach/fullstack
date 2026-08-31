import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn() },
        lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({
    ConsentService: { recordConsent: vi.fn() },
    ConsentMethod: { WEB_FORM: "WEB_FORM" },
}));

import { csvIngestionService } from "./csvIngestionService";

const CSV = "email,fullName\nlead@example.com,Test Lead\n";

describe("csvIngestionService.processCSV - cross-tenant campaign scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    it("drops a campaignId that doesn't belong to the importing team instead of linking leads to it", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null); // campaign belongs to another team
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        const result = await csvIngestionService.processCSV(CSV, "team-a", undefined, "campaign-from-team-b");

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-from-team-b", teamId: "team-a" },
            select: { id: true },
        });
        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: undefined }),
        });
        expect(result.success).toBe(true);
    });

    it("links leads to campaignId when it does belong to the importing team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.count.mockResolvedValue(1);
        mockPrisma.campaign.update.mockResolvedValue({});

        await csvIngestionService.processCSV(CSV, "team-a", undefined, "campaign-1");

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: "campaign-1" }),
        });
    });
});
