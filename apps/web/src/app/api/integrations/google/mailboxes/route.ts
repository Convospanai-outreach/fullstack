import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { prisma } = await import("@/lib/db");
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const mailboxes = await prisma.connectedMailbox.findMany({
            where: { teamId: ctx.teamId },
            select: {
                id: true,
                teamId: true,
                assignedUserId: true,
                provider: true,
                authType: true,
                email: true,
                displayName: true,
                status: true,
                tokenExpiresAt: true,
                lastSyncAt: true,
                historyId: true,
                dailyLimit: true,
                sentToday: true,
                minDelaySeconds: true,
                lastSentAt: true,
                isWarmingUp: true,
                warmupDay: true,
                warmupTargetDays: true,
                bounceCount: true,
                replyCount: true,
                openCount: true,
                clickCount: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ mailboxes });
    } catch (error: any) {
        console.error("[Mailboxes API] Failed to fetch connected mailboxes:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
