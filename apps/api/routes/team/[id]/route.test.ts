import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole, mockCheckTeamPermission, mockRemoveMember, mockAuditLog } = vi.hoisted(() => ({
    mockPrisma: { teamMember: { findFirst: vi.fn() } },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockRemoveMember: vi.fn(),
    mockAuditLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin", OWNER: "owner", MEMBER: "member" },
    authorizeRole: mockAuthorizeRole,
    checkTeamPermission: mockCheckTeamPermission,
}));
vi.mock("@/modules/team/service/teamService", () => ({ teamService: { removeMember: mockRemoveMember } }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAuditLog } }));

import { DELETE } from "./route";

function remove(id = "member-1") {
    return DELETE(new Request("http://localhost/team/" + id, { method: "DELETE" }), { params: Promise.resolve({ id }) });
}

describe("DELETE /team/[id] - audit trail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "admin-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "member-1", teamId: "team-1", role: "member" });
        mockRemoveMember.mockResolvedValue({ id: "member-1" });
        mockAuditLog.mockResolvedValue(undefined);
    });

    it("records who removed which member, and the role they held", async () => {
        const res = await remove();

        expect(res.status).toBe(200);
        expect(mockAuditLog).toHaveBeenCalledWith("team-1", "admin-1", "MEMBER_REMOVED", "TeamMember", "member-1", { role: "member" });
    });

    it("records a removal of an admin by an owner", async () => {
        mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "member-2", teamId: "team-1", role: "admin" });

        await remove("member-2");

        expect(mockAuditLog).toHaveBeenCalledWith("team-1", "admin-1", "MEMBER_REMOVED", "TeamMember", "member-2", { role: "admin" });
    });

    it("writes no row when the removal is refused", async () => {
        mockRemoveMember.mockRejectedValue(new Error("Cannot remove the last owner of the team."));

        await remove();

        expect(mockAuditLog).not.toHaveBeenCalled();
    });
});
