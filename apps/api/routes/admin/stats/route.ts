import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/admin";
import { logger } from "@/lib/logger";

export async function GET(_req: Request) {
    // Platform-wide counts (all tenants) - SYSTEM_ADMIN only; ORG_ADMIN is
    // customer-assignable and must not see cross-tenant totals (S-05).
    const isAdmin = await checkAdmin(UserRole.SYSTEM_ADMIN);
    if (!isAdmin) {
        return new NextResponse("Unauthorized", { status: 403 });
    }

    try {
        const [
            userCount,
            teamCount,
            campaignsTotal,
            campaignsActive,
            jobsPending,
            jobsFailed,
            creditTransactions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.team.count(),
            prisma.campaign.count(),
            prisma.campaign.count({ where: { status: "active" } }),
            prisma.job.count({ where: { status: "pending" } }),
            prisma.job.count({ where: { status: "failed" } }),
            prisma.creditTransaction.aggregate({
                _sum: { amount: true },
                where: { type: "usage" }
            })
        ]);

        return NextResponse.json({
            users: userCount,
            teams: teamCount,
            campaigns: {
                total: campaignsTotal,
                active: campaignsActive
            },
            jobs: {
                pending: jobsPending,
                failed: jobsFailed
            },
            creditsUsed: Math.abs(creditTransactions._sum.amount || 0)
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Admin API] Stats fetch failed:", { error: errorMessage });
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
