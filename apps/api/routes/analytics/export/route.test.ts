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

describe("GET /analytics/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.lead.findMany.mockResolvedValue([]);
    });

    it("streams a bounded, team-scoped CSV", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findMany.mockResolvedValue([
            {
                id: "l1",
                fullName: "Jane",
                email: "j@a.com",
                company: "Acme",
                status: "NEW",
                value: 500,
                wonAt: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                campaign: { name: "Q1" },
            },
        ]);

        const res = await GET(makeRequest());
        const text = await res.text(); // drain the stream

        expect(res.headers.get("x-stream-body")).toBe("1");
        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-a" }, take: 1000 })
        );

        const lines = text.split("\n");
        expect(lines[0]).toBe("Name,Email,Company,Status,Deal Value,Won Date,Campaign,Created");
        expect(lines).toHaveLength(2);
        expect(lines[1]).toContain("j@a.com");
        expect(lines[1]).toContain("Q1");
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
