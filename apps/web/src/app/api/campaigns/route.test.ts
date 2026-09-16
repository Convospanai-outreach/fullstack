import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockPrisma: {
        campaign: { create: vi.fn(), findMany: vi.fn() },
        lead: { updateMany: vi.fn() },
        iCP: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/campaigns", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/campaigns", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.campaign.create.mockResolvedValue({ id: "campaign-1", name: "Recover WARM leads" });
        mockPrisma.iCP.findFirst.mockResolvedValue({ id: "icp-1", teamId: "team-a" });
    });

    it("persists sourcePipelineStage when creating a stage-targeted campaign", async () => {
        await POST(postRequest({ name: "Recover WARM leads", sourcePipelineStage: "WARM", leads: ["lead-1", "lead-2"], icpId: "icp-1" }));

        expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ sourcePipelineStage: "WARM", icpId: "icp-1" }),
        });
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["lead-1", "lead-2"] }, teamId: "team-a" },
            data: { campaignId: "campaign-1" },
        });
    });

    it("leaves sourcePipelineStage unset for a plain campaign", async () => {
        await POST(postRequest({ name: "Plain campaign", icpId: "icp-1" }));

        expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ sourcePipelineStage: undefined }),
        });
    });

    it("rejects campaign creation when icpId is missing", async () => {
        const res = await POST(postRequest({ name: "No ICP campaign" }));

        expect(res.status).toBe(400);
        expect(mockPrisma.campaign.create).not.toHaveBeenCalled();
    });

    it("rejects campaign creation when icpId doesn't belong to the team", async () => {
        mockPrisma.iCP.findFirst.mockResolvedValue(null);

        const res = await POST(postRequest({ name: "Bad ICP campaign", icpId: "icp-other-team" }));

        expect(res.status).toBe(400);
        expect(mockPrisma.campaign.create).not.toHaveBeenCalled();
    });
});
