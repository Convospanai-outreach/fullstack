import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function makeRequest() {
    return new Request("http://localhost/api/analytics/export") as any;
}

describe("GET /analytics/export - team scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.lead.findMany.mockResolvedValue([]);
    });

    it("scopes the lead export to the caller's own team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        await GET(makeRequest());

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-a" } })
        );
    });

    it("rejects a caller with no team before querying any leads", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: null });

        const res = await GET(makeRequest());

        expect(res.status).toBe(401);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated caller before querying any leads", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await GET(makeRequest());

        expect(res.status).toBe(401);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });
});
