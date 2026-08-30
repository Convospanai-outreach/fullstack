import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        teamMember: {
            findFirst: vi.fn(),
            count: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { teamService } from "./teamService";

describe("teamService - cross-tenant scoping", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("removeMember", () => {
        it("refuses to remove a member that doesn't belong to the given team (cross-tenant IDOR)", async () => {
            // findFirst scoped to {id, teamId} finds nothing when memberId belongs to another team.
            mockPrisma.teamMember.findFirst.mockResolvedValue(null);

            await expect(teamService.removeMember("team-a", "member-from-team-b")).rejects.toThrow("Member not found");

            expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
                where: { id: "member-from-team-b", teamId: "team-a" },
            });
            expect(mockPrisma.teamMember.delete).not.toHaveBeenCalled();
        });

        it("removes a same-team, non-owner member", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "member-1", teamId: "team-a", role: "member" });
            mockPrisma.teamMember.delete.mockResolvedValue({});

            await teamService.removeMember("team-a", "member-1");

            expect(mockPrisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: "member-1" } });
        });

        it("refuses to remove the team's last owner", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "owner-1", teamId: "team-a", role: "owner" });
            mockPrisma.teamMember.count.mockResolvedValue(1);

            await expect(teamService.removeMember("team-a", "owner-1")).rejects.toThrow("last owner");
            expect(mockPrisma.teamMember.delete).not.toHaveBeenCalled();
        });
    });

    describe("updateRole", () => {
        it("refuses to update a member that doesn't belong to the given team (cross-tenant IDOR)", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue(null);

            await expect(teamService.updateRole("team-a", "member-from-team-b", "admin")).rejects.toThrow("Member not found");

            expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
                where: { id: "member-from-team-b", teamId: "team-a" },
            });
            expect(mockPrisma.teamMember.update).not.toHaveBeenCalled();
        });

        it("updates a same-team member's role", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "member-1", teamId: "team-a", role: "member" });
            mockPrisma.teamMember.update.mockResolvedValue({});

            await teamService.updateRole("team-a", "member-1", "admin");

            expect(mockPrisma.teamMember.update).toHaveBeenCalledWith({
                where: { id: "member-1" },
                data: { role: "admin" },
            });
        });

        it("refuses to demote the team's last owner", async () => {
            mockPrisma.teamMember.findFirst.mockResolvedValue({ id: "owner-1", teamId: "team-a", role: "owner" });
            mockPrisma.teamMember.count.mockResolvedValue(1);

            await expect(teamService.updateRole("team-a", "owner-1", "admin")).rejects.toThrow("last owner");
            expect(mockPrisma.teamMember.update).not.toHaveBeenCalled();
        });
    });
});
