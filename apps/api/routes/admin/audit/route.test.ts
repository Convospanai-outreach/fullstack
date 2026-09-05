import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockPrisma: {
        user: { findUnique: vi.fn() },
        teamMember: { findFirst: vi.fn() },
        auditLog: { count: vi.fn(), findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function getRequest() {
    return new Request("http://localhost/api/admin/audit") as any;
}

describe("GET /admin/audit - tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog.count.mockResolvedValue(0);
        mockPrisma.auditLog.findMany.mockResolvedValue([]);
    });

    it("403s an ORG_ADMIN with no team membership", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue(null);

        const res = await GET(getRequest());

        expect(res.status).toBe(403);
        expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("scopes an ORG_ADMIN's query to their own team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-1" });

        await GET(getRequest());

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ orgId: "team-1" }) })
        );
    });

    it("allows a SYSTEM_ADMIN to query platform-wide with no team filter", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "admin-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "SYSTEM_ADMIN" });

        await GET(getRequest());

        expect(mockPrisma.teamMember.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.not.objectContaining({ orgId: expect.anything() }) })
        );
    });
});
