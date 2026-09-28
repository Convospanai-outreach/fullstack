import { beforeEach, describe, expect, it, vi } from "vitest";

// roadmap 3.3 (S-10): PATCH /api/campaigns/[id] wrote any `status` string
// straight into Campaign.status. It must now be one of the real statuses.

const { mockCampaign } = vi.hoisted(() => ({
    mockCampaign: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(async () => ({ userId: "user-1", teamId: "team-1" })),
}));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    authorizeRole: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db", () => ({ prisma: { campaign: mockCampaign } }));
vi.mock("@/lib/campaignService", () => ({
    CampaignService: { startCampaign: vi.fn(), pauseCampaign: vi.fn(), addLeadsToCampaign: vi.fn() },
}));

import { PATCH } from "@/app/api/campaigns/[id]/route";

function patch(body: unknown) {
    return PATCH(
        new Request("http://localhost/api/campaigns/camp-1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: "camp-1" }) }
    );
}

describe("PATCH /api/campaigns/[id] status validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCampaign.findFirst.mockResolvedValue({ id: "camp-1", teamId: "team-1", leadList: [] });
        mockCampaign.findUnique.mockResolvedValue({ id: "camp-1", leadList: [] });
        mockCampaign.update.mockResolvedValue({});
    });

    it("rejects an arbitrary status string without writing it", async () => {
        const res = await patch({ status: "<script>pwned</script>" });
        expect(res.status).toBe(400);
        expect(mockCampaign.update).not.toHaveBeenCalled();
    });

    it("still writes a real status", async () => {
        const res = await patch({ status: "completed", name: "Q4 push" });
        expect(res.status).toBe(200);
        expect(mockCampaign.update).toHaveBeenCalledWith({
            where: { id: "camp-1" },
            data: { status: "completed", name: "Q4 push" },
        });
    });
});
