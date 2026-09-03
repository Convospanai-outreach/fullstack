/**
 * Admin Actions API
 * Handles specific operator commands like "start-scrapers", "pause-outreach", "sync-crm"
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { UserRole } from "@prisma/client";

// ORG_ADMIN is a normal, self-service-assignable per-workspace role (any team owner
// can invite a teammate as ORG_ADMIN - see WORKSPACE_ASSIGNABLE_ROLES). Only
// SYSTEM_ADMIN/SUPER_ADMIN are genuine platform-level operators allowed to act on an
// arbitrary team; an ORG_ADMIN caller must be a member of whatever teamId is used.
const PLATFORM_LEVEL_ROLES: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN];

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
        } else if (teamId && !PLATFORM_LEVEL_ROLES.includes(admin.enterpriseRole)) {
            // A client-supplied teamId must not let a workspace-level ORG_ADMIN act on
            // another tenant's data - verify membership before honoring it.
            const membership = await prisma.teamMember.findFirst({
                where: { userId, teamId },
                select: { teamId: true }
            });
            if (!membership) {
                return NextResponse.json({ error: "Forbidden: not a member of the given team" }, { status: 403 });
            }
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
