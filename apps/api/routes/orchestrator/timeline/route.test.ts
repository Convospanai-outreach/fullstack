import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        job: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function getRequest(campaignId: string | null) {
    const url = campaignId
        ? `http://localhost/orchestrator/timeline?campaignId=${campaignId}`
        : "http://localhost/orchestrator/timeline";
    return new Request(url) as any;
}

describe("GET /orchestrator/timeline", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.job.findMany.mockResolvedValue([]);
    });

    it("rejects an unauthenticated caller before querying anything", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await GET(getRequest("campaign-1"));

        expect(res.status).toBe(401);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
    });

    it("refuses to return the timeline for another team's campaign", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        const res = await GET(getRequest("campaign-from-team-b"));

        expect(res.status).toBe(404);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-from-team-b", teamId: "team-a" },
        });
        expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
    });

    it("returns the job timeline for a campaign belonging to the caller's own team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-a" });
        mockPrisma.job.findMany.mockResolvedValue([
            { id: "job-1", type: "campaign_execution", status: "completed", createdAt: new Date(), startedAt: null, completedAt: null, error: null, attempts: 1, result: {} },
        ]);

        const res = await GET(getRequest("campaign-1"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.timeline).toHaveLength(1);
    });
});
