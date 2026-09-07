import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockCheckTeamPermission, mockHandleCampaignExecution } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn() },
    },
    mockCheckTeamPermission: vi.fn(),
    mockHandleCampaignExecution: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/workers/handlers/campaign-execution-worker", () => ({
    handleCampaignExecution: mockHandleCampaignExecution,
}));

import { POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /api/campaigns/[id]/run - requires at least MEMBER (OPEN-218)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-1" });
        mockPrisma.campaign.update.mockResolvedValue({ id: "campaign-1", status: "active" });
        mockHandleCampaignExecution.mockResolvedValue({ enqueued: 1 });
    });

    it("rejects a caller below MEMBER role before activating the campaign", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(res.status).toBe(403);
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
    });

    it("activates the campaign for a MEMBER-or-above caller", async () => {
        const res = await POST(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
            where: { id: "campaign-1" },
            data: { status: "active" },
        });
        expect(mockHandleCampaignExecution).toHaveBeenCalled();
    });
});
