import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    // Strict Admin Check
    if (!session || (session.user as any).enterpriseRole !== UserRole.SYSTEM_ADMIN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const timeRange = searchParams.get("range") || "24h";

        // Calculate start date
        const now = new Date();
        const startDate = new Date();
        if (timeRange === "24h") startDate.setHours(now.getHours() - 24);
        if (timeRange === "7d") startDate.setDate(now.getDate() - 7);
        if (timeRange === "30d") startDate.setDate(now.getDate() - 30);

        // 1. Contract Denials (Security Events)
        const denials = await prisma.systemEvent.findMany({
            where: {
                name: "CONTRACT_DENIAL",
                timestamp: { gte: startDate }
            },
            orderBy: { timestamp: "desc" },
            take: 100
        });

        // 2. Kill Switch Triggers
        const killSwitchEvents = await prisma.systemEvent.findMany({
            where: {
                name: "KILL_SWITCH_TRIGGERED",
                timestamp: { gte: startDate }
            },
            orderBy: { timestamp: "desc" }
        });

        // 3. System Stats (Aggregate)
        const activeTeams = await prisma.contractProfile.count({
            where: { contractStatus: "ACTIVE" }
        });

        const suspendedTeams = await prisma.contractProfile.count({
            where: { contractStatus: "SUSPENDED" }
        });

        // 4. Usage Data (AI Tokens)
        const usageLogs = await prisma.lLMUsageLog.groupBy({
            by: ['teamId'],
            where: { createdAt: { gte: startDate } },
            _sum: {
                tokensIn: true,
                tokensOut: true,
                cost: true
            }
        });

        return NextResponse.json({
            metrics: {
                activeTeams,
                suspendedTeams,
                totalDenials: denials.length,
                totalKillSwitch: killSwitchEvents.length,
            },
            events: {
                denials,
                killSwitch: killSwitchEvents
            },
            usage: usageLogs
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
