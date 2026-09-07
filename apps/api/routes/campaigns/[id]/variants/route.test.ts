import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAuthorizeRole } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        campaignVariant: { deleteMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    },
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));

import { POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
    return new Request("http://localhost/campaigns/campaign-1/variants", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /campaigns/[id]/variants - requires at least MEMBER (OPEN-209)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-1" });
        mockPrisma.campaignVariant.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.campaignVariant.create.mockImplementation(async ({ data }) => ({ id: "variant-1", ...data }));
    });

    it("rejects a caller below MEMBER role (e.g. a read-only VIEWER) before deleting or creating any variant", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValue(new APIError("Insufficient permissions", 403));

        const res = await POST(postRequest([{ subject: "s", body: "b" }]), paramsFor("campaign-1"));

        expect(res.status).toBe(403);
        expect(mockPrisma.campaignVariant.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.campaignVariant.create).not.toHaveBeenCalled();
    });

    it("replaces variants for a MEMBER-or-above caller owning the campaign", async () => {
        const res = await POST(postRequest([{ subject: "s", body: "b" }]), paramsFor("campaign-1"));

        expect(res.status).toBe(201);
        expect(mockPrisma.campaignVariant.deleteMany).toHaveBeenCalledWith({ where: { campaignId: "campaign-1" } });
        expect(mockPrisma.campaignVariant.create).toHaveBeenCalled();
    });
});
