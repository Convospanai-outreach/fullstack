import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockPrisma, mockEnqueue, mockEnforcePolicy, mockCheckLimits, mockAudit } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    },
    mockEnqueue: vi.fn(),
    mockEnforcePolicy: vi.fn(),
    mockCheckLimits: vi.fn(),
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: mockEnforcePolicy }));
vi.mock("@/lib/governance/limits", () => ({ checkLimits: mockCheckLimits }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/orchestrator/run", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /orchestrator/run - governance ordering and team scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-1" });
        mockCheckLimits.mockResolvedValue(undefined);
        mockEnqueue.mockResolvedValue({ id: "job-1" });
        mockAudit.mockResolvedValue(undefined);
    });

    it("returns 401 when the caller has no session team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: null });

        const res = await POST(postRequest({ campaignId: "campaign-1" }));

        expect(res.status).toBe(401);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });

    it("404s a campaign belonging to another team instead of deriving governance checks from it", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        const res = await POST(postRequest({ campaignId: "campaign-foreign" }));

        expect(res.status).toBe(404);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({ where: { id: "campaign-foreign", teamId: "team-1" } });
        expect(mockCheckLimits).not.toHaveBeenCalled();
        expect(mockEnforcePolicy).not.toHaveBeenCalled();
    });

    it("does not schedule the campaign when governance rejects the request (this used to run unconditionally before any check)", async () => {
        mockEnforcePolicy.mockRejectedValue(new Error("APPROVAL_REQUIRED"));

        const res = await POST(postRequest({ campaignId: "campaign-1", startDate: "2026-09-05T00:00:00.000Z" }));

        expect(res.status).toBe(403);
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.updateMany).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("scopes the scheduled-status update to the campaign's own team once governance passes", async () => {
        mockEnforcePolicy.mockResolvedValue(true);
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 1 });

        const res = await POST(postRequest({ campaignId: "campaign-1", startDate: "2026-09-05T00:00:00.000Z" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
            where: { id: "campaign-1", teamId: "team-1" },
            data: { status: "scheduled", scheduledStart: new Date("2026-09-05T00:00:00.000Z") },
        });
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });
});
