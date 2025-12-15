
import { prisma } from "@/lib/db";

export class TeamService {
    static async getMembers(teamId: string) {
        return await prisma.teamMember.findMany({
            where: { teamId },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });
    }

    static async inviteMember(teamId: string, email: string, role: string = "member") {
        // Check if already a member
        const existing = await prisma.teamMember.findFirst({
            where: { teamId, email }
        });

        if (existing) {
            throw new Error("User is already a team member or invited");
        }

        // Create member record
        const member = await prisma.teamMember.create({
            data: {
                teamId,
                email,
                role,
                status: "invited"
            }
        });

        // Here we would send an actual email via EmailService
        console.log(`[Mock Email] Invite sent to ${email} for team ${teamId}`);

        return member;
    }

    static async updateRole(memberId: string, role: string) {
        return await prisma.teamMember.update({
            where: { id: memberId },
            data: { role }
        });
    }

    static async removeMember(memberId: string) {
        return await prisma.teamMember.delete({
            where: { id: memberId }
        });
    }
}
