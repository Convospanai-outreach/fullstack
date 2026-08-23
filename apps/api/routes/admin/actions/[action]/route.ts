/**
 * Admin Actions API
 * Handles specific operator commands like "start-scrapers", "pause-outreach", "sync-crm"
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ action: string }> }
) {
    const admin = await getAdminUser();

    // Strict RBAC: Only Admin or Operator
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
    }

    const { action } = await params;

    try {
        // REG-6 Fix: Use the already-resolved admin identity with first-team fallback.
        // Avoids getCurrentContext() which throws 409 for multi-tenant admins
        // who have no workspace cookie set — a common scenario for operators.
        const userId = admin.id;

        // Allow an optional teamId in request body for scoped operations
        let teamId: string | null = null;
        try {
            const body = await req.json();
            teamId = body?.teamId ?? null;
        } catch { /* no body is fine, teamId stays null */ }

        // If teamId not provided in body, fall back to the admin's first team
        if (!teamId && userId) {
            const membership = await prisma.teamMember.findFirst({
                where: { userId },
                select: { teamId: true }
            });
            teamId = membership?.teamId ?? null;
        }

        switch (action) {
            case "start-scrapers":
                logger.info("[Admin] Starting all scrapers...");
                await JobQueue.enqueue("linkedin_scraping", { action: "FULL_SURVEY" }, { teamId });
                return NextResponse.json({ success: true, message: "Scrapers job enqueued" });

            case "pause-outreach":
                logger.info("[Admin] Pausing outreach campaigns...");
                const result = await prisma.campaign.updateMany({
                    where: { teamId: teamId ?? undefined, status: "active" },
                    data: { status: "paused" }
                });
                return NextResponse.json({ success: true, message: `Paused ${result.count} campaigns` });

            case "sync-crm":
                logger.info("[Admin] Syncing CRM...");
                await JobQueue.enqueue("CRM_SYNC", { provider: "HUBSPOT" }, { teamId });
                return NextResponse.json({ success: true, message: "CRM sync job enqueued" });

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: any) {
        logger.error(`[Admin] Action ${action} failed: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
