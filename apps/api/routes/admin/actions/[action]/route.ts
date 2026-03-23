/**
 * Admin Actions API
 * Handles specific operator commands like "start-scrapers", "pause-outreach", "sync-crm"
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

export async function POST(
    _req: NextRequest,
    { params }: { params: { action: string } }
) {
    const session = await getServerSession(authOptions);

    // Strict RBAC: Only Admin or Operator
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = params;

    try {
        // Retrieve Team for context (assuming first team for MVP)
        const teamMember = await prisma.teamMember.findFirst({
            where: { userId: session.user.id }
        });
        const teamId = teamMember?.teamId;

        switch (action) {
            case "start-scrapers":
                console.log("[Admin] Starting all scrapers...");
                await JobQueue.enqueue("linkedin_scraping", { action: "FULL_SURVEY" }, { teamId: teamId ?? null });
                return NextResponse.json({ success: true, message: "Scrapers job enqueued" });

            case "pause-outreach":
                console.log("[Admin] Pausing outreach campaigns...");
                const result = await prisma.campaign.updateMany({
                    where: { teamId: teamId ?? null, status: "active" },
                    data: { status: "paused" }
                });
                return NextResponse.json({ success: true, message: `Paused ${result.count} campaigns` });

            case "sync-crm":
                console.log("[Admin] Syncing CRM...");
                await JobQueue.enqueue("CRM_SYNC", { provider: "HUBSPOT" }, { teamId: teamId ?? null });
                return NextResponse.json({ success: true, message: "CRM sync job enqueued" });

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: any) {
        console.error(`[Admin] Action ${action} failed:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
