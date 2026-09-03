import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
        return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    try {
        // Jobs are matched by payload->campaignId (see below) rather than
        // Job.teamId, which enqueuers don't reliably set - so verify the
        // campaign itself belongs to the caller's team first. Without this, a
        // guessed/enumerated campaignId from another team would leak that
        // team's job timeline, including error messages and results.
        const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId } });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        // Fetch jobs related to this campaign
        // Note: We rely on payload->campaignId
        const jobs = await prisma.job.findMany({
            where: {
                payload: {
                    path: ["campaignId"],
                    equals: campaignId
                }
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 100 // Limit for performance
        });

        // Also fetch any direct workflow runs if they are linked (future proofing)
        // For now, we focus on Jobs

        const timeline = jobs.map(job => ({
            id: job.id,
            type: job.type,
            status: job.status,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            error: job.error,
            attempts: job.attempts,
            meta: job.result // simplified
        }));

        return NextResponse.json({ timeline });
    } catch (error) {
        console.error("Error fetching timeline:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
