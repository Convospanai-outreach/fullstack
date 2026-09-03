import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGlobalClient, mockUaeClient, mockGetClient, mockGetCurrentContext } = vi.hoisted(() => ({
    mockGlobalClient: { scrapingJob: { findMany: vi.fn() } },
    mockUaeClient: { scrapingJob: { findMany: vi.fn() } },
    mockGetClient: vi.fn(),
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/dbFactory", () => ({
    DbFactory: { getClient: mockGetClient },
}));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));

import { GET } from "./route";

describe("GET /agent/outreach/drafts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env['UAE_DATABASE_URL'];
        mockGetClient.mockImplementation((region: string) =>
            region === "UAE" ? mockUaeClient : mockGlobalClient
        );
        mockGlobalClient.scrapingJob.findMany.mockResolvedValue([]);
        mockUaeClient.scrapingJob.findMany.mockResolvedValue([]);
    });

    it("rejects an unauthenticated caller before querying anything", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await GET();

        expect(res.status).toBe(401);
        expect(mockGlobalClient.scrapingJob.findMany).not.toHaveBeenCalled();
    });

    it("scopes the Global DB query by the caller's teamId", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        await GET();

        expect(mockGlobalClient.scrapingJob.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ status: "COMPLETED", teamId: "team-a" }) })
        );
    });

    it("scopes the UAE DB query by the caller's teamId when configured", async () => {
        process.env['UAE_DATABASE_URL'] = "postgres://uae";
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        await GET();

        expect(mockUaeClient.scrapingJob.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { status: "COMPLETED", teamId: "team-a" } })
        );
    });
});
