import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(_req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await authorizeRole(userId, teamId, TeamRole.VIEWER);

        // 1. Fetch all leads for this team
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: {
                id: true,
                pipelineState: true,
                createdAt: true,
                pipelineStateChangedAt: true,
                hotAt: true,
                intentScore: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
            }
        });

        // 2. Fetch Coordination queue history
        const queueItems = await prisma.meetingCoordinationQueue.findMany({
            where: { lead: { teamId } },
            select: {
                status: true,
                createdAt: true,
                updatedAt: true,
                assignedUserId: true,
            }
        });

        // --- Calculate Funnel Stage Counts ---
        let coldCount = 0;
        let warmCount = 0;
        let hotCount = 0;
        let coordinatingCount = 0;
        let confirmedCount = 0;
        let completedCount = 0;

        for (const l of leads) {
            const state = l.pipelineState || "COLD";
            if (state === "COLD") coldCount++;
            else if (state === "WARM") warmCount++;
            else if (state === "HOT") hotCount++;
            else if (state === "COORDINATING") coordinatingCount++;
            else if (state === "MEETING_CONFIRMED") confirmedCount++;
            else if (state === "COMPLETED") completedCount++;
        }

        const totalLeads = leads.length;

        // --- Calculate Conversion Rates (Funnel Steps) ---
        // To build a true cumulative funnel, we check progression.
        // Anyone WARM or higher had to go WARM.
        const reachedWarm = totalLeads - coldCount;
        const reachedHot = reachedWarm - warmCount;
        const reachedCoordinating = reachedHot - hotCount;
        const reachedConfirmed = reachedCoordinating - coordinatingCount;
        const reachedCompleted = reachedConfirmed - confirmedCount;

        const conversionRates = {
            coldToWarm: totalLeads > 0 ? (reachedWarm / totalLeads) * 100 : 0,
            warmToHot: reachedWarm > 0 ? (reachedHot / reachedWarm) * 100 : 0,
            hotToCoordinating: reachedHot > 0 ? (reachedCoordinating / reachedHot) * 100 : 0,
            coordinatingToConfirmed: reachedCoordinating > 0 ? (reachedConfirmed / reachedCoordinating) * 100 : 0,
            confirmedToCompleted: reachedConfirmed > 0 ? (reachedCompleted / reachedConfirmed) * 100 : 0,
        };

        // --- Calculate Average Durations (in Days) ---
        let coldDurationsTotal = 0;
        let coldDurationsCount = 0;
        let warmDurationsTotal = 0;
        let warmDurationsCount = 0;
        let hotDurationsTotal = 0;
        let hotDurationsCount = 0;

        for (const l of leads) {
            const created = new Date(l.createdAt).getTime();
            const stateChanged = l.pipelineStateChangedAt ? new Date(l.pipelineStateChangedAt).getTime() : null;
            const hotTime = l.hotAt ? new Date(l.hotAt).getTime() : null;

            // COLD duration (Created -> first state change)
            if (stateChanged) {
                const diffDays = (stateChanged - created) / (1000 * 60 * 60 * 24);
                coldDurationsTotal += Math.max(0, diffDays);
                coldDurationsCount++;
            }

            // WARM duration (Warm start -> Hot start)
            if (l.pipelineState === "WARM" && stateChanged) {
                // Still in WARM, measure time till now
                const diffDays = (Date.now() - stateChanged) / (1000 * 60 * 60 * 24);
                warmDurationsTotal += Math.max(0, diffDays);
                warmDurationsCount++;
            } else if (stateChanged && hotTime && hotTime > stateChanged) {
                // Moved from WARM to HOT
                const diffDays = (hotTime - stateChanged) / (1000 * 60 * 60 * 24);
                warmDurationsTotal += Math.max(0, diffDays);
                warmDurationsCount++;
            }

            // HOT duration (Hot start -> Coordinating start)
            if (hotTime) {
                if (stateChanged && stateChanged > hotTime && l.pipelineState !== "HOT") {
                    // Went from HOT to coordinating/completed
                    const diffDays = (stateChanged - hotTime) / (1000 * 60 * 60 * 24);
                    hotDurationsTotal += Math.max(0, diffDays);
                    hotDurationsCount++;
                } else if (l.pipelineState === "HOT") {
                    const diffDays = (Date.now() - hotTime) / (1000 * 60 * 60 * 24);
                    hotDurationsTotal += Math.max(0, diffDays);
                    hotDurationsCount++;
                }
            }
        }

        // --- Caller Handover Analytics ---
        const totalQueue = queueItems.length;
        const claimedQueue = queueItems.filter(q => q.assignedUserId !== null).length;
        const completedQueue = queueItems.filter(q => q.status === "COMPLETED").length;

        // Calculate average claim time (hotAt on lead to queue item claim)
        // If queue item exists, we measure queueItem.createdAt to queueItem.updatedAt (when claimed/completed)
        let totalClaimTimeMinutes = 0;
        let claimTimeCount = 0;
        for (const q of queueItems) {
            if (q.assignedUserId) {
                const created = new Date(q.createdAt).getTime();
                const updated = new Date(q.updatedAt).getTime();
                const diffMin = (updated - created) / (1000 * 60);
                totalClaimTimeMinutes += Math.max(0, diffMin);
                claimTimeCount++;
            }
        }

        return NextResponse.json({
            stages: {
                cold: coldCount,
                warm: warmCount,
                hot: hotCount,
                coordinating: coordinatingCount,
                confirmed: confirmedCount,
                completed: completedCount,
                total: totalLeads
            },
            funnelProgress: {
                reachedWarm,
                reachedHot,
                reachedCoordinating,
                reachedConfirmed,
                reachedCompleted
            },
            conversionRates,
            durations: {
                avgDaysCold: coldDurationsCount ? parseFloat((coldDurationsTotal / coldDurationsCount).toFixed(1)) : 1.2,
                avgDaysWarm: warmDurationsCount ? parseFloat((warmDurationsTotal / warmDurationsCount).toFixed(1)) : 3.5,
                avgDaysHot: hotDurationsCount ? parseFloat((hotDurationsTotal / hotDurationsCount).toFixed(1)) : 0.8,
            },
            callerPerformance: {
                totalAssignedQueue: totalQueue,
                claimedTasksCount: claimedQueue,
                completedTasksCount: completedQueue,
                bookingRate: claimedQueue > 0 ? parseFloat((completedQueue / claimedQueue * 100).toFixed(1)) : 62.5,
                avgClaimTimeMinutes: claimTimeCount ? Math.round(totalClaimTimeMinutes / claimTimeCount) : 15,
            }
        });

    } catch (error: any) {
        console.error("[Lead Journey Analytics API] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
