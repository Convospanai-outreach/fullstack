import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockAuth, mockPerms } = vi.hoisted(() => ({
    mockPrisma: {
        workflow: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
    mockAuth: {
        getCurrentContext: vi.fn(),
    },
    mockPerms: {
        checkTeamPermission: vi.fn(),
        TeamRole: { ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockAuth.getCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockPerms.checkTeamPermission,
    TeamRole: mockPerms.TeamRole,
}));

describe("Workflows RBAC (SEC-04)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u-viewer", teamId: "team-1" });
    });

    describe("POST /api/workflows", () => {
        it("returns 403 when user is not admin", async () => {
            mockPerms.checkTeamPermission.mockResolvedValue(false);
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/workflows", {
                method: "POST",
                body: JSON.stringify({ name: "Malicious Workflow" }),
            });
            const res = await POST(req);

            expect(res.status).toBe(403);
            expect(mockPrisma.workflow.create).not.toHaveBeenCalled();
        });

        it("creates workflow when user has admin role", async () => {
            mockPerms.checkTeamPermission.mockResolvedValue(true);
            mockPrisma.workflow.create.mockResolvedValue({ id: "wf-1", name: "Approved Workflow" });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/workflows", {
                method: "POST",
                body: JSON.stringify({ name: "Approved Workflow" }),
            });
            const res = await POST(req);

            expect(res.status).toBe(200);
            expect(mockPrisma.workflow.create).toHaveBeenCalled();
        });
    });

    describe("PUT /api/workflows/[id]", () => {
        it("returns 403 when user is not admin", async () => {
            mockPerms.checkTeamPermission.mockResolvedValue(false);
            const { PUT } = await import("../[id]/route");

            const req = new NextRequest("http://localhost/api/workflows/wf-1", {
                method: "PUT",
                body: JSON.stringify({ name: "Hacked" }),
            });
            const res = await PUT(req, { params: Promise.resolve({ id: "wf-1" }) });

            expect(res.status).toBe(403);
            expect(mockPrisma.workflow.update).not.toHaveBeenCalled();
        });
    });

    describe("DELETE /api/workflows/[id]", () => {
        it("returns 403 when user is not admin", async () => {
            mockPerms.checkTeamPermission.mockResolvedValue(false);
            const { DELETE } = await import("../[id]/route");

            const req = new NextRequest("http://localhost/api/workflows/wf-1", { method: "DELETE" });
            const res = await DELETE(req, { params: Promise.resolve({ id: "wf-1" }) });

            expect(res.status).toBe(403);
            expect(mockPrisma.workflow.delete).not.toHaveBeenCalled();
        });
    });
});
