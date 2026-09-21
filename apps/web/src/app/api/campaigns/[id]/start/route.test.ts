import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockGetCurrentContext,
    mockCheckTeamPermission,
    mockPrisma,
    mockEnrollCampaignLeads,
    mockHandleCampaignExecution,
} = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn() },
        lead: { count: vi.fn() },
    },
    mockEnrollCampaignLeads: vi.fn(),
    mockHandleCampaignExecution: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/lib/campaigns/enrollment", () => ({ enrollCampaignLeads: mockEnrollCampaignLeads }));
vi.mock("@/workers/handlers/campaign-execution-worker", () => ({ handleCampaignExecution: mockHandleCampaignExecution }));

import { POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}
function call(id = "campaign-1") {
    return POST(new Request("http://localhost") as any, paramsFor(id));
}

describe("POST /api/campaigns/[id]/start - unified guarded start (roadmap 2.12 / B-12)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-1" });
        mockPrisma.campaign.update.mockResolvedValue({});
        mockPrisma.lead.count.mockResolvedValue(3);
    });

    it("401s an unauthenticated caller", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const res = await call();
        expect(res.status).toBe(401);
        expect(mockEnrollCampaignLeads).not.toHaveBeenCalled();
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
    });

    it("403s a caller below MEMBER before doing anything", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const res = await call();
        expect(res.status).toBe(403);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
        expect(mockEnrollCampaignLeads).not.toHaveBeenCalled();
    });

    it("404s when the campaign is not in the caller's team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        const res = await call();
        expect(res.status).toBe(404);
        expect(mockEnrollCampaignLeads).not.toHaveBeenCalled();
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
    });

    it("takes the sequence path and marks the campaign active when a runnable sequence exists", async () => {
        mockEnrollCampaignLeads.mockResolvedValue({ ok: true, candidates: 3, enrolled: 2, alreadyEnrolled: 1 });
        const res = await call();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toMatchObject({ success: true, mode: "sequence", enrolled: 2, alreadyEnrolled: 1 });
        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({ where: { id: "campaign-1" }, data: { status: "active" } });
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
    });

    it("falls back to the direct-draft path when there is no sequence", async () => {
        mockEnrollCampaignLeads.mockResolvedValue({ ok: false, code: "NO_SEQUENCE", error: "no sequence" });
        mockHandleCampaignExecution.mockResolvedValue({ enqueued: 5 });
        const res = await call();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toMatchObject({ success: true, mode: "draft", enqueued: 5 });
        expect(mockHandleCampaignExecution).toHaveBeenCalledWith({ campaignId: "campaign-1", teamId: "team-1", userId: "user-1" });
        // The draft worker sets status active itself; /start must not double-write it.
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("refuses to start an empty campaign (no sequence, no leads) instead of drafting to arbitrary team leads", async () => {
        mockEnrollCampaignLeads.mockResolvedValue({ ok: false, code: "NO_SEQUENCE", error: "no sequence" });
        mockPrisma.lead.count.mockResolvedValue(0);
        const res = await call();
        expect(res.status).toBe(400);
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("surfaces an unrunnable sequence as a 400 instead of silently drafting", async () => {
        mockEnrollCampaignLeads.mockResolvedValue({ ok: false, code: "UNSUPPORTED_STEP", error: "step 2 unsupported" });
        const res = await call();
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body.error).toBe("step 2 unsupported");
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });
});
