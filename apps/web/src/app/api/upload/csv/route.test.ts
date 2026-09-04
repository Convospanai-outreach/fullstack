import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
        campaign: { findFirst: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

function csvRequest(body: unknown) {
    return new Request("http://localhost/api/upload/csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/upload/csv", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.count.mockResolvedValue(1);
        mockPrisma.campaign.update.mockResolvedValue({ id: "campaign-1" });
    });

    it("drops a campaignId that doesn't belong to the caller's team instead of linking leads to it", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null); // campaign belongs to another team

        await POST(
            csvRequest({ csv: "email\nfoo@example.com", campaignId: "campaign-from-team-b" })
        );

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-from-team-b", teamId: "team-a" },
            select: { id: true },
        });
        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.not.objectContaining({ campaignId: expect.anything() }),
        });
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("links leads to a campaignId that belongs to the caller's own team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });

        await POST(
            csvRequest({ csv: "email\nfoo@example.com", campaignId: "campaign-1" })
        );

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: "campaign-1" }),
        });
        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
            where: { id: "campaign-1" },
            data: { targetCount: 1 },
        });
    });

    it("rejects an unauthenticated caller before touching any lead data", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(csvRequest({ csv: "email\nfoo@example.com" }));

        expect(res.status).toBe(401);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });
});
