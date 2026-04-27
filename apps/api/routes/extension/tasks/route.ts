import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../_lib/auth";
import { resolveExtensionTeamScope } from "../_lib/teamScope";

export async function GET(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (auth.teamIds.length === 0) {
            return NextResponse.json({ tasks: [] });
        }
        const teamScope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
        if (!teamScope.ok) {
            return NextResponse.json({ error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }
        const teamId = teamScope.teamId;

        if (process.env.LINKEDIN_AUTOMATION_ENABLED !== "true") {
            return NextResponse.json({ tasks: [] });
        }

        const dailyCap = Number(process.env.LINKEDIN_DAILY_MAX_INVITES) || 15;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const actionsToday = await prisma.job.count({
            where: {
                teamId,
                type: { in: ["VIEW_PROFILE", "LIKE_POST", "CONNECT"] },
                completedAt: { gte: startOfDay }
            }
        });

        if (actionsToday >= dailyCap) {
            return NextResponse.json({ tasks: [], capReached: true, remainingToday: 0 });
        }

        const claimedAt = new Date();

        // Fetch a small candidate set, then atomically claim jobs one-by-one.
        // This avoids returning tasks that another poller already grabbed.
        const candidates = await prisma.job.findMany({
            where: {
                teamId,
                status: { in: ["pending", "queued"] },
                type: { in: ["VIEW_PROFILE", "LIKE_POST", "CONNECT"] }
            },
            take: 5, // Batch size
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" }
            ]
        });

        const claimedTasks: Array<{ id: string; type: string; payload: unknown }> = [];

        for (const candidate of candidates) {
            const claim = await prisma.job.updateMany({
                where: {
                    id: candidate.id,
                    teamId,
                    status: { in: ["pending", "queued"] }
                },
                data: {
                    status: "processing",
                    startedAt: claimedAt
                }
            });

            if (claim.count === 1) {
                claimedTasks.push({
                    id: candidate.id,
                    type: candidate.type,
                    payload: candidate.payload
                });
            }
        }

        return NextResponse.json({ tasks: claimedTasks });

    } catch (error: any) {
        console.error("Error fetching extension tasks:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
