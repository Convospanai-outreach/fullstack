import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetCurrentContextFromRequest, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockPrisma: {
        user: { findUnique: vi.fn() },
        teamMember: { findFirst: vi.fn() },
        systemEvent: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET, POST } from "./route";

function getRequest(query = "") {
    return new NextRequest(`http://localhost/api/admin/agent-audit${query}`);
}

function postRequest(body: any) {
    return new NextRequest("http://localhost/api/admin/agent-audit", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("GET /admin/agent-audit - tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.systemEvent.findMany.mockResolvedValue([]);
    });

    it("scopes an ORG_ADMIN's query to their own team, ignoring omitted teamId", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-1" });

        await GET(getRequest());

        expect(mockPrisma.systemEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ teamId: "team-1" }) })
        );
    });

    it("403s an ORG_ADMIN who requests a teamId they don't belong to", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-1" });

        const res = await GET(getRequest("?teamId=team-victim"));

        expect(res.status).toBe(403);
        expect(mockPrisma.systemEvent.findMany).not.toHaveBeenCalled();
    });

    it("allows a SYSTEM_ADMIN to query an arbitrary team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "admin-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "SYSTEM_ADMIN" });

        await GET(getRequest("?teamId=team-any"));

        expect(mockPrisma.teamMember.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.systemEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ teamId: "team-any" }) })
        );
    });

    it("allows a SYSTEM_ADMIN to query platform-wide with no teamId", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "admin-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "SYSTEM_ADMIN" });

        await GET(getRequest());

        expect(mockPrisma.systemEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.not.objectContaining({ teamId: expect.anything() }) })
        );
    });
});

describe("POST /admin/agent-audit - tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.systemEvent.findMany.mockResolvedValue([]);
    });

    it("scopes an ORG_ADMIN's export to their own team, ignoring a foreign teamId", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-1" });

        const res = await POST(postRequest({ teamId: "team-victim" }));

        expect(res.status).toBe(403);
        expect(mockPrisma.systemEvent.findMany).not.toHaveBeenCalled();
    });
});
