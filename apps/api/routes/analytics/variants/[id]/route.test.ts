import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockGetVariantComparison } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockGetVariantComparison: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    authorizeRole: mockAuthorizeRole,
}));
vi.mock("@/modules/analytics/service/analyticsService", () => ({
    analyticsService: { getVariantComparison: mockGetVariantComparison },
}));

import { GET } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("GET /analytics/variants/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockGetVariantComparison.mockResolvedValue([]);
    });

    it("rejects an unauthenticated caller before querying anything", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await GET(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(res.status).toBe(401);
        expect(mockGetVariantComparison).not.toHaveBeenCalled();
    });

    it("passes the caller's teamId through so the service can scope the query", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });

        await GET(new Request("http://localhost") as any, paramsFor("campaign-from-team-b"));

        expect(mockGetVariantComparison).toHaveBeenCalledWith("campaign-from-team-b", "team-1");
    });
});
