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

        return await prisma.teamMember.delete({
            where: { id: memberId }
        });
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

        return await prisma.teamMember.update({
            where: { id: memberId },
            data: { role: newRole }
        });
    }
}

export const teamService = new TeamService();
