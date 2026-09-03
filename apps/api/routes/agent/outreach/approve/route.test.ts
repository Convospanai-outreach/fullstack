import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGlobalClient, mockGetClient, mockGetCurrentContext } = vi.hoisted(() => ({
    mockGlobalClient: {
        scrapingJob: { updateMany: vi.fn(), findFirst: vi.fn() },
    },
    mockGetClient: vi.fn(),
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/dbFactory", () => ({
    DbFactory: { getClient: mockGetClient },
}));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/agent/outreach/approve", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /agent/outreach/approve", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetClient.mockReturnValue(mockGlobalClient);
    });

    it("rejects an unauthenticated caller before touching the job", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ id: "job-1", action: "APPROVE" }));

        expect(res.status).toBe(401);
        expect(mockGlobalClient.scrapingJob.updateMany).not.toHaveBeenCalled();
    });

    it("refuses to approve/reject another team's job", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockGlobalClient.scrapingJob.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(postRequest({ id: "job-from-team-b", action: "APPROVE" }));

        expect(res.status).toBe(404);
        expect(mockGlobalClient.scrapingJob.updateMany).toHaveBeenCalledWith({
            where: { id: "job-from-team-b", teamId: "team-a" },
            data: { status: "ACTIONED" },
        });
        expect(mockGlobalClient.scrapingJob.findFirst).not.toHaveBeenCalled();
    });

    it("approves a job belonging to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockGlobalClient.scrapingJob.updateMany.mockResolvedValue({ count: 1 });
        mockGlobalClient.scrapingJob.findFirst.mockResolvedValue({ id: "job-1", teamId: "team-a", status: "ACTIONED" });

        const res = await POST(postRequest({ id: "job-1", action: "APPROVE" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.job.status).toBe("ACTIONED");
        expect(mockGlobalClient.scrapingJob.findFirst).toHaveBeenCalledWith({ where: { id: "job-1", teamId: "team-a" } });
    });

    it("rejects a job belonging to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockGlobalClient.scrapingJob.updateMany.mockResolvedValue({ count: 1 });
        mockGlobalClient.scrapingJob.findFirst.mockResolvedValue({ id: "job-1", teamId: "team-a", status: "REJECTED" });

        const res = await POST(postRequest({ id: "job-1", action: "REJECT" }));

        expect(res.status).toBe(200);
        expect(mockGlobalClient.scrapingJob.updateMany).toHaveBeenCalledWith({
            where: { id: "job-1", teamId: "team-a" },
            data: { status: "REJECTED" },
        });
    });
});
