import { prisma } from "@/lib/db";
import { TeamRole } from "@/lib/permissions";

class TeamService {

    async getMembers(teamId: string) {
        return await prisma.teamMember.findMany({
            where: { teamId },
            include: { user: { select: { name: true, image: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }

    async inviteMember(teamId: string, email: string, role: string = "member") {
        // Check if already in team
        const existing = await prisma.teamMember.findFirst({
            where: { teamId, email }
        });

        if (existing) {
            throw new Error("User already in team (or invited)");
        }

        // Check if user exists in system
        const user = await prisma.user.findUnique({ where: { email } });

        return await prisma.teamMember.create({
            data: {
                teamId,
                email,
                userId: user?.id || null, // Null if pending
                role,
                status: user ? "active" : "invited"
            }
        });
    }

    async removeMember(teamId: string, memberId: string) {
        // Scoped to teamId - without this, an admin on one team could remove a member
        // row belonging to a completely different team by id (cross-tenant IDOR).
        const member = await prisma.teamMember.findFirst({ where: { id: memberId, teamId } });
        if (!member) throw new Error("Member not found");

        if (member.role === TeamRole.OWNER) {
            const ownerCount = await prisma.teamMember.count({
                where: { teamId, role: TeamRole.OWNER }
            });
            if (ownerCount <= 1) {
                throw new Error("Cannot remove the last owner of the team.");
            }
        }

        // The mutation itself must also be scoped, not just the pre-check above -
        // TeamMember has no compound unique on (id, teamId), so delete() can't take
        // teamId directly; deleteMany() is used instead.
        const deleted = await prisma.teamMember.deleteMany({
            where: { id: memberId, teamId }
        });
        if (deleted.count === 0) throw new Error("Member not found");
        return member;
    }

    async updateRole(teamId: string, memberId: string, newRole: string) {
        // Scoped to teamId - same cross-tenant IDOR concern as removeMember above.
        const member = await prisma.teamMember.findFirst({ where: { id: memberId, teamId } });
        if (!member) throw new Error("Member not found");

        if (member.role === TeamRole.OWNER && newRole !== TeamRole.OWNER) {
            const ownerCount = await prisma.teamMember.count({
                where: { teamId, role: TeamRole.OWNER }
            });
            if (ownerCount <= 1) {
                throw new Error("Cannot demote the last owner of the team.");
            }
        }

        // Same reasoning as removeMember() - updateMany() is used since update() can't
        // take teamId without a compound unique on (id, teamId).
        const updated = await prisma.teamMember.updateMany({
            where: { id: memberId, teamId },
            data: { role: newRole }
        });
        if (updated.count === 0) throw new Error("Member not found");
        return { ...member, role: newRole };
    }
}

export const teamService = new TeamService();
