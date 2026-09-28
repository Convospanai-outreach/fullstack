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

    it("quotes and formula-neutralizes CSV cells from the event payload (roadmap 3.5 / S-14)", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockPrisma.user.findUnique.mockResolvedValue({ enterpriseRole: "SYSTEM_ADMIN" });
        mockPrisma.systemEvent.findMany.mockResolvedValue([
            {
                timestamp: new Date("2026-01-01T00:00:00.000Z"),
                name: "=1+1",
                actorId: "SYSTEM",
                teamId: "team-1",
                // A comma inside an unquoted cell would start a new, un-neutralized one.
                payload: { taskId: "x,=cmd|' /C calc'!A0" },
            },
        ]);

        const res = await POST(postRequest({ format: "csv" }));
        const text = await res.text();

        expect(text).toContain(`2026-01-01T00:00:00.000Z,"'=1+1","SYSTEM","team-1","x,=cmd|' /C calc'!A0"`);
    });
});
