import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockGetClient } = vi.hoisted(() => {
    const db = {
        lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        campaign: { findFirst: vi.fn() },
    };
    return { mockDb: db, mockGetClient: vi.fn(() => db) };
});

vi.mock("@/lib/dbFactory", () => ({
    DbFactory: { getClient: mockGetClient },
}));
vi.mock("@/modules/audit/auditService", () => ({
    AuditService: { log: vi.fn() },
}));

import { LeadService } from "./LeadService";

describe("LeadService.upsert - campaignId ownership", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.lead.findFirst.mockResolvedValue(null);
        mockDb.lead.create.mockResolvedValue({ id: "lead-1", email: "a@b.com" });
    });

    it("rejects a campaignId belonging to a different team", async () => {
        mockDb.campaign.findFirst.mockResolvedValue(null);

        await expect(
            LeadService.upsert("team-1", "user-1", { email: "a@b.com", campaignId: "campaign-victim" })
        ).rejects.toThrow("Invalid campaignId");
    });

    it("allows a campaignId that belongs to the caller's own team", async () => {
        mockDb.campaign.findFirst.mockResolvedValue({ id: "campaign-own" });

        await LeadService.upsert("team-1", "user-1", { email: "a@b.com", campaignId: "campaign-own" });

        expect(mockDb.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-own", teamId: "team-1" },
            select: { id: true },
        });
    });

    it("skips the campaign check when no campaignId is supplied", async () => {
        await LeadService.upsert("team-1", "user-1", { email: "a@b.com" });

        expect(mockDb.campaign.findFirst).not.toHaveBeenCalled();
    });
});
