
import { prisma } from "@/lib/db";

export class UsageService {
    static async getUsageStats(teamId: string) {
        const quotas = await prisma.userQuota.findMany({ where: { teamId } });

        if (quotas.length > 0) {
            const currentSpend = quotas.reduce((acc, q) => acc + q.currentSpend, 0);
            const monthlyLimit = quotas.reduce((acc, q) => acc + q.monthlyLimit, 0);
            return { teamId, currentSpend, monthlyLimit, credits: Math.max(0, monthlyLimit - currentSpend) };
        }

        // No UserQuota rows yet (nobody has spent anything this cycle) - fall back to the
        // same per-user default checkCreditQuota/incrementSpend use in src/lib/governance/limits.ts.
        const [policy, memberCount] = await Promise.all([
            prisma.organizationPolicy.findUnique({ where: { organizationId: teamId } }),
            prisma.teamMember.count({ where: { teamId } })
        ]);
        const monthlyLimit = (policy?.maxCreditsPerUser ?? 50) * Math.max(1, memberCount);

        return { teamId, currentSpend: 0, monthlyLimit, credits: monthlyLimit };
    }
}

export const usageService = {
    getTeamUsage: (teamId: string) => UsageService.getUsageStats(teamId)
};
