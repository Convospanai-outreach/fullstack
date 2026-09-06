import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
        campaign: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

const FOREIGN_CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OWN_CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/leads - campaignId team scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.update.mockResolvedValue({ id: "lead-1" });
    });

    it("drops a campaignId that doesn't belong to the caller's team instead of linking the lead to it", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null); // belongs to another team

        await POST(postRequest({ email: "foo@example.com", campaignId: FOREIGN_CAMPAIGN_ID }));

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: FOREIGN_CAMPAIGN_ID, teamId: "team-a" },
            select: { id: true },
        });
        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: null }),
        });
    });

    it("links the lead to a campaignId that belongs to the caller's own team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: OWN_CAMPAIGN_ID });

        await POST(postRequest({ email: "foo@example.com", campaignId: OWN_CAMPAIGN_ID }));

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: OWN_CAMPAIGN_ID }),
        });
    });

    it("rejects an unauthenticated caller before touching any lead data", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ email: "foo@example.com", campaignId: OWN_CAMPAIGN_ID }));

        expect(res.status).toBe(401);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });
});
