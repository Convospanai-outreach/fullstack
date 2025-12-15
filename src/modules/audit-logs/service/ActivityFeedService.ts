
import { prisma } from "@/lib/db";

class ActivityFeedService {
    /**
     * Get operational activity for a campaign (e.g. "Email sent", "Lead replied")
     */
    async getCampaignActivity(campaignId: string, limit = 50) {
        return prisma.activity.findMany({
            where: { campaignId },
            orderBy: { createdAt: "desc" },
            take: limit
        });
    }

    /**
     * Get system-wide audit logs for admins
     */
    async getSystemLogs(limit = 100) {
        return prisma.activityLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit
        });
    }

    /**
     * Log a system action (Helper for other services)
     */
    async logSystemAction(action: string, meta?: any) {
        return prisma.activityLog.create({
            data: {
                action,
                meta
            }
        });
    }
}

export const activityFeedService = new ActivityFeedService();
