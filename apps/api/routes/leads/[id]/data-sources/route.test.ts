import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn() },
        leadDataSource: { findMany: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { MEMBER: "MEMBER" },
}));

import { GET } from "./route";

describe("GET /leads/[id]/data-sources", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("401s when unauthenticated", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: null, userId: null });

        const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "lead-1" }) });

        expect(res.status).toBe(401);
        expect(mockPrisma.leadDataSource.findMany).not.toHaveBeenCalled();
    });

    it("404s when the lead doesn't belong to the caller's team", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "lead-1" }) });

        expect(res.status).toBe(404);
        expect(mockPrisma.leadDataSource.findMany).not.toHaveBeenCalled();
    });

    it("returns the lead's data sources ordered most-recent-first", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1" });
        mockPrisma.leadDataSource.findMany.mockResolvedValue([
            { id: "ds-1", field: "email", source: "HUNTER", value: "jane@acme.example", confidence: null, capturedAt: new Date() },
        ]);

        const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "lead-1" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(mockPrisma.leadDataSource.findMany).toHaveBeenCalledWith({
            where: { leadId: "lead-1" },
            orderBy: { capturedAt: "desc" },
        });
        expect(body.dataSources).toHaveLength(1);
    });
});
