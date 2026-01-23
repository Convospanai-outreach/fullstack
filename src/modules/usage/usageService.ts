import { prisma } from "@/lib/db";

export class UsageService {
    async getUsage(teamId: string) {
        let quota = await prisma.userQuota.findFirst({
            where: { teamId }
        });

        if (!quota) {
            // Return a default object if no quota is found, without creating a record.
            // This avoids creating "bad records" with placeholder user IDs.
            return {
                id: "default", // A placeholder ID as this object doesn't exist in DB
                teamId: teamId,
                userId: "default", // Placeholder for consistency, but not persisted
                monthlyLimit: 1000,
                currentSpend: 0,
                createdAt: new Date(), // Placeholder
                updatedAt: new Date()  // Placeholder
            };
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
        const quota = await prisma.userQuota.findFirst({
            where: { teamId }
        });

        if (quota) {
            await prisma.userQuota.update({
                where: { id: quota.id },
                data: { currentSpend: { increment: amount } }
            });
        }
    }

    async checkAvailability(teamId: string, cost: number = 1): Promise<boolean> {
        const quota = await this.getTeamUsage(teamId);
        return quota.currentSpend + cost <= quota.monthlyLimit;
    }
}

export const usageService = new UsageService();
