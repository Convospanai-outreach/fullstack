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

    async inviteMember(teamId: string, email: string, role: TeamRole = TeamRole.MEMBER) {
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
        // Prevent removing the last owner? 
        // Logic: fetch member, check role. If owner, check if other owners exist.
        // For now, allow simple removal for non-owners, strict for owners.

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

        // Scoped by teamId here too, not just in the pre-check above - the mutation's
        // own safety must not depend solely on a separate pre-check holding true (see
        // OPEN-99/OPEN-109/OPEN-110/OPEN-118 for the same anti-pattern). TeamMember has
        // no compound unique on (id, teamId), so delete() can't take teamId directly -
        // deleteMany() is used instead.
        const deleted = await prisma.teamMember.deleteMany({
            where: { id: memberId, teamId }
        });
        if (deleted.count === 0) throw new Error("Member not found");
        return member;
    }

    async updateRole(teamId: string, memberId: string, newRole: TeamRole) {
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

        // Scoped by teamId here too, not just in the pre-check above - same reasoning
        // as removeMember(). updateMany() is used since update() can't take teamId
        // without a compound unique on (id, teamId).
        const updated = await prisma.teamMember.updateMany({
            where: { id: memberId, teamId },
            data: { role: newRole }
        });
        if (updated.count === 0) throw new Error("Member not found");
        return { ...member, role: newRole };
    }
}

export const teamService = new TeamService();
