import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const DAILY_LIMITS: Record<string, number> = {
    "LIKE": 50,
    "COMMENT": 30,
    "CONNECT": 20,
    "SCRAPE": 100,
    "INMAIL": 20
};

export class RateLimitService {
    static async checkLimit(actionType: string): Promise<boolean> {
        const limit = DAILY_LIMITS[actionType];
        if (!limit) return true; // No limit defined

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const count = await prisma.activity.count({
            where: {
                type: actionType,
                createdAt: {
                    gte: startOfDay
                }
            }
        });

        logger.debug(`Rate Limit Check: ${actionType} - ${count}/${limit}`, { actionType, count, limit });
        return count < limit;
    }

    static async incrementUsage(actionType: string, meta?: any) {
        await prisma.activity.create({
            data: {
                type: actionType,
                meta: meta || {}
            }
        });
    }
}
