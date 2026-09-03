import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { deleteMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        campaign: { deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { bulkService } from "./BulkService";

describe("bulkService.deleteResources - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    it("scopes lead deletion to the requesting team", async () => {
        mockPrisma.lead.deleteMany.mockResolvedValue({ count: 2 });

        const result = await bulkService.deleteResources("lead", ["lead-1", "lead-2"], "team-1");

        expect(mockPrisma.lead.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["lead-1", "lead-2"] }, teamId: "team-1" },
        });
        expect(result).toEqual({ count: 2 });
    });

    it("scopes campaign deletion to the requesting team", async () => {
        mockPrisma.campaign.deleteMany.mockResolvedValue({ count: 1 });

        await bulkService.deleteResources("campaign", ["campaign-1"], "team-1");

        expect(mockPrisma.campaign.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["campaign-1"] }, teamId: "team-1" },
        });
    });
});

describe("bulkService.tagResources - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    it("only tags leads that belong to the requesting team, skipping the rest", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "my-lead" }]);
        mockPrisma.lead.update.mockResolvedValue({});

        const result = await bulkService.tagResources("lead", ["my-lead", "other-teams-lead"], ["vip"], "team-1");

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith({
            where: { id: { in: ["my-lead", "other-teams-lead"] }, teamId: "team-1" },
            select: { id: true },
        });
        expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "my-lead" },
            data: { tags: { push: ["vip"] } },
        });
        expect(result).toEqual({ count: 1 });
    });

    it("tags nothing when none of the given IDs belong to the requesting team", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([]);

        const result = await bulkService.tagResources("lead", ["other-teams-lead"], ["vip"], "team-1");

        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
        expect(result).toEqual({ count: 0 });
    });
});
