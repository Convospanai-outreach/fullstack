import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        aiDraftBatch: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER", ADMIN: "ADMIN" },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/campaignService", () => ({ CampaignService: { getCampaignStats: vi.fn().mockResolvedValue({}) } }));

import { GET, PATCH } from "./route";

const ctx = { params: Promise.resolve({ id: "campaign-1" }) };
const patch = (body: unknown) => new Request("http://localhost/api/campaigns/campaign-1", { method: "PATCH", body: JSON.stringify(body) }) as any;

describe("campaign draftGenerationMode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-a", status: "draft", leadList: [] });
        mockPrisma.campaign.findUnique.mockResolvedValue({ id: "campaign-1", leadList: [] });
    });

    it("PATCH writes BATCH on a draft campaign, scoped by the team-checked lookup", async () => {
        const res = await PATCH(patch({ draftGenerationMode: "BATCH" }), ctx);

        expect(res.status).toBe(200);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "campaign-1", teamId: "team-a" } }));
        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({ where: { id: "campaign-1" }, data: { draftGenerationMode: "BATCH" } });
    });

    it("PATCH rejects unknown modes (400) and changes after the campaign started (409)", async () => {
        expect((await PATCH(patch({ draftGenerationMode: "TURBO" }), ctx)).status).toBe(400);

        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-a", status: "active", leadList: [] });
        expect((await PATCH(patch({ draftGenerationMode: "BATCH" }), ctx)).status).toBe(409);
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("PATCH returns 404 for another team's campaign without writing", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        expect((await PATCH(patch({ draftGenerationMode: "BATCH" }), ctx)).status).toBe(404);
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("GET includes the latest draft batch progress, team-scoped", async () => {
        mockPrisma.aiDraftBatch.findFirst.mockResolvedValue({ status: "polling", itemCount: 12 });

        const res = await GET(new Request("http://localhost/api/campaigns/campaign-1"), ctx);
        const json = await res.json();

        expect(mockPrisma.aiDraftBatch.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { campaignId: "campaign-1", teamId: "team-a" } }));
        expect(json.draftBatch).toEqual({ status: "polling", itemCount: 12 });
    });
});
