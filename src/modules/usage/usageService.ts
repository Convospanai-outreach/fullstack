import { prisma } from "@/lib/db";

export class UsageService {
    async getUsage(teamId: string) {
        let quota = await prisma.userQuota.findFirst({
            where: { teamId }
        });

        if (!quota) {
            // Find the team owner or at least one user to attach the quota to
            const member = await prisma.teamMember.findFirst({
                where: { teamId },
                orderBy: { role: 'asc' } // prioritize 'admin' or 'owner' over 'member'
            });

            if (!member || !member.userId) {
                throw new Error(`Cannot create UserQuota: Team ${teamId} has no assigned users.`);
            }

            // Create a real record so it can be incremented later
            quota = await prisma.userQuota.create({
                data: {
                    teamId,
                    userId: member.userId,
                    monthlyLimit: 1000,
                    currentSpend: 0
                }
            });
        }
        return quota;
    }

    async getTeamUsage(teamId: string) {
        // Aggregate or find the main team quota
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { credits: true }
        });

        const quota = await prisma.userQuota.findFirst({
            where: { teamId }
        });

        const credits = team?.credits || 0;

        if (!quota) return { currentSpend: 0, monthlyLimit: 1000, teamId, credits };
        return { ...quota, credits };
    }

    async incrementUsage(teamId: string, amount: number = 1) {
        // Use getUsage to ensure the record exists (it auto-creates if missing)
        const quota = await this.getUsage(teamId);

        await prisma.userQuota.update({
            where: { id: quota.id },
            data: { currentSpend: { increment: amount } }
        });
    }

    async checkAvailability(teamId: string, cost: number = 1): Promise<boolean> {
        const quota = await this.getTeamUsage(teamId);
        return quota.currentSpend + cost <= quota.monthlyLimit;
    }
}

export const usageService = new UsageService();
