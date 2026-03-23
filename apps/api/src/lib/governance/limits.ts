import { prisma } from "@/lib/db";

export async function checkLimits(orgId: string, action: string) {
    const policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: orgId }
    });

    if (!policy) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Count actions for this org today
    const dailyActions = await prisma.auditLog.count({
        where: {
            orgId,
            createdAt: { gte: startOfDay }
        }
    });

    if (dailyActions >= policy.maxDailyActions) {
        throw new Error("DAILY_ACTION_LIMIT_REACHED");
    }

    // Specific Resource Caps
    if (action === "CAMPAIGN_CREATE") {
        const campaignCount = await prisma.campaign.count({ where: { teamId: orgId } });
        if (campaignCount >= policy.maxCampaigns) {
            throw new Error("MAX_CAMPAIGNS_REACHED");
        }
    }

    // Add more specific caps as needed
}

export async function checkCreditQuota(userId: string, orgId: string, amount: number = 1) {
    const policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: orgId }
    });

    if (!policy) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 1. Get User Quota (Override or Default)
    let quota = await prisma.userQuota.findUnique({
        where: { userId_teamId: { userId, teamId: orgId } }
    });

    // Reset if it's a new month
    if (quota && quota.lastReset < startOfMonth) {
        quota = await prisma.userQuota.update({
            where: { id: quota.id },
            data: { currentSpend: 0, lastReset: new Date() }
        });
    }

    const limit = quota?.monthlyLimit ?? policy.maxCreditsPerUser;
    const currentSpend = quota?.currentSpend ?? 0;

    if (currentSpend + amount > limit) {
        if (policy.requiresApprovalForOverage) {
            const { APIError } = await import("@/lib/apiResponse");
            throw new APIError("CREDIT_QUOTA_EXCEEDED", 403);
        }
    }
}

export async function incrementSpend(userId: string, orgId: string, amount: number = 1) {
    await prisma.userQuota.upsert({
        where: { userId_teamId: { userId, teamId: orgId } },
        update: { currentSpend: { increment: amount } },
        create: {
            userId,
            teamId: orgId,
            monthlyLimit: 50, // Should probably fetch from policy default if first time
            currentSpend: amount,
            lastReset: new Date()
        }
    });
}
