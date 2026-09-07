import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        teamMember: {
            findFirst: vi.fn(),
            count: vi.fn(),
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { teamService } from "./teamService";

// removeMember/updateRole each look up the target member first, then the
// acting caller's own role (via getTeamRole) - both go through
// teamMember.findFirst, so tests queue mockResolvedValueOnce in that order.

describe("teamService - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("removeMember", () => {
        it("refuses to remove a member that doesn't belong to the given team (cross-tenant IDOR)", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue(null);

            await expect(teamService.removeMember("team-a", "member-from-team-b", "owner-1")).rejects.toThrow("Member not found");

            expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
                where: { id: "member-from-team-b", teamId: "team-a" },
            });
            expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
        });

        it("removes a same-team, non-owner member when the caller outranks them, scoping the actual delete by teamId too", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "member-1", teamId: "team-a", role: "member" })
                .mockResolvedValueOnce({ role: "admin" });
            mockPrisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });

            await teamService.removeMember("team-a", "member-1", "admin-1");

            expect(mockPrisma.teamMember.deleteMany).toHaveBeenCalledWith({
                where: { id: "member-1", teamId: "team-a" },
            });
        });

        it("refuses to remove the team's last owner", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "owner-1", teamId: "team-a", role: "owner" })
                .mockResolvedValueOnce({ role: "owner" });
            mockPrisma.teamMember.count.mockResolvedValue(1);

            await expect(teamService.removeMember("team-a", "owner-1", "owner-2")).rejects.toThrow("last owner");
            expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
        });

        it("refuses to let an ADMIN remove a fellow ADMIN (OPEN-225)", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "admin-target", teamId: "team-a", role: "admin" })
                .mockResolvedValueOnce({ role: "admin" });

            await expect(teamService.removeMember("team-a", "admin-target", "admin-caller")).rejects.toThrow("Insufficient permissions");
            expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
        });

        it("refuses to let an ADMIN remove an OWNER even when other owners exist (OPEN-225)", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "owner-1", teamId: "team-a", role: "owner" })
                .mockResolvedValueOnce({ role: "admin" });

            await expect(teamService.removeMember("team-a", "owner-1", "admin-caller")).rejects.toThrow("Insufficient permissions");
            expect(mockPrisma.teamMember.count).not.toHaveBeenCalled();
            expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
        });
    });

    describe("updateRole", () => {
        it("refuses to update a member that doesn't belong to the given team (cross-tenant IDOR)", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue(null);

            await expect(teamService.updateRole("team-a", "member-from-team-b", "admin" as any, "owner-1")).rejects.toThrow("Member not found");

            expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
                where: { id: "member-from-team-b", teamId: "team-a" },
            });
            expect(mockPrisma.teamMember.updateMany).not.toHaveBeenCalled();
        });

        it("updates a same-team member's role when the caller outranks them, scoping the actual update by teamId too", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "member-1", teamId: "team-a", role: "member" })
                .mockResolvedValueOnce({ role: "owner" });
            mockPrisma.teamMember.updateMany.mockResolvedValue({ count: 1 });

            await teamService.updateRole("team-a", "member-1", "admin" as any, "owner-1");

            expect(mockPrisma.teamMember.updateMany).toHaveBeenCalledWith({
                where: { id: "member-1", teamId: "team-a" },
                data: { role: "admin" },
            });
        });

        it("refuses to demote the team's last owner", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "owner-1", teamId: "team-a", role: "owner" })
                .mockResolvedValueOnce({ role: "owner" });
            mockPrisma.teamMember.count.mockResolvedValue(1);

            await expect(teamService.updateRole("team-a", "owner-1", "admin" as any, "owner-2")).rejects.toThrow("last owner");
            expect(mockPrisma.teamMember.updateMany).not.toHaveBeenCalled();
        });

        it("refuses to let an ADMIN demote a fellow ADMIN (OPEN-225)", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "admin-target", teamId: "team-a", role: "admin" })
                .mockResolvedValueOnce({ role: "admin" });

            await expect(teamService.updateRole("team-a", "admin-target", "member" as any, "admin-caller")).rejects.toThrow("Insufficient permissions");
            expect(mockPrisma.teamMember.updateMany).not.toHaveBeenCalled();
        });

        it("refuses to let an ADMIN demote an OWNER even when other owners exist (OPEN-225)", async () => {
            mockPrisma.teamMember.findFirst
                .mockResolvedValueOnce({ id: "owner-1", teamId: "team-a", role: "owner" })
                .mockResolvedValueOnce({ role: "admin" });

            await expect(teamService.updateRole("team-a", "owner-1", "admin" as any, "admin-caller")).rejects.toThrow("Insufficient permissions");
            expect(mockPrisma.teamMember.count).not.toHaveBeenCalled();
            expect(mockPrisma.teamMember.updateMany).not.toHaveBeenCalled();
        });
    });
});
