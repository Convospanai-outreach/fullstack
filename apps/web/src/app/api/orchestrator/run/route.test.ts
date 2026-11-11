import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockCheckTeamPermission, mockPrisma, mockHandleCampaignExecution, mockCheckCampaignStartApproval } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: { campaign: { findFirst: vi.fn(), update: vi.fn() } },
    mockHandleCampaignExecution: vi.fn(),
    mockCheckCampaignStartApproval: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/lib/governance/campaignStartApproval", () => ({ checkCampaignStartApproval: mockCheckCampaignStartApproval }));
vi.mock("@/workers/handlers/campaign-execution-worker", () => ({ handleCampaignExecution: mockHandleCampaignExecution }));

import { POST } from "./route";

const run = () =>
    POST(new Request("http://localhost/api/orchestrator/run", { method: "POST", body: JSON.stringify({ campaignId: "campaign-1" }) }));

// The dashboard's Run and Schedule buttons reach this web route (the proxy keeps orchestrator/run on apps/web).
describe("POST /api/orchestrator/run (web)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-a" });
        mockCheckCampaignStartApproval.mockResolvedValue({ allowed: true });
        mockHandleCampaignExecution.mockResolvedValue({ enqueued: 3 });
    });

    it("rejects a caller below MEMBER without touching the campaign", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await run();

        expect(res.status).toBe(403);
        expect(mockCheckTeamPermission).toHaveBeenCalledWith("user-1", "team-a", "MEMBER");
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
    });

    it("returns 202 and starts nothing while the campaign awaits approval", async () => {
        mockCheckCampaignStartApproval.mockResolvedValue({ allowed: false, status: 202, body: { status: "pending_approval", approvalId: "appr-1", message: "waiting" } });

        const res = await run();

        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ status: "pending_approval", approvalId: "appr-1" });
        expect(mockCheckCampaignStartApproval).toHaveBeenCalledWith({ teamId: "team-a", userId: "user-1", campaignId: "campaign-1" });
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
        expect(mockHandleCampaignExecution).not.toHaveBeenCalled();
    });

    it("rejects a signed-out caller, a missing campaignId and another team's campaign", async () => {
        mockGetCurrentContext.mockResolvedValueOnce({ userId: null, teamId: null });
        expect((await run()).status).toBe(401);

        const noId = await POST(new Request("http://localhost/api/orchestrator/run", { method: "POST", body: "{}" }));
        expect(noId.status).toBe(400);

        mockPrisma.campaign.findFirst.mockResolvedValueOnce(null);
        expect((await run()).status).toBe(404);

        expect(mockCheckCampaignStartApproval).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("still reports the campaign active when the execution worker fails, and returns 500 on errors", async () => {
        mockHandleCampaignExecution.mockRejectedValueOnce(new Error("queue down"));
        const res = await run();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, enqueued: 0 });

        mockPrisma.campaign.update.mockRejectedValueOnce(new Error("db down"));
        expect((await run()).status).toBe(500);
    });

    it("starts the campaign when no approval is needed or it is approved", async () => {
        const res = await run();

        expect(res.status).toBe(200);
        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({ where: { id: "campaign-1" }, data: { status: "active" } });
        expect(mockHandleCampaignExecution).toHaveBeenCalled();
    });
});
