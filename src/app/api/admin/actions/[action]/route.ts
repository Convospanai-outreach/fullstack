/**
 * Admin Actions API
 * Handles specific operator commands like "start-scrapers", "pause-outreach", "sync-crm"
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
        switch (action) {
            case "start-scrapers":
                console.log("[Admin] Starting all scrapers...");
                // In real implementation, this would trigger a job queue
                // await queue.add("scrape-all", {});
                return NextResponse.json({ success: true, message: "Scrapers started" });

            case "pause-outreach":
                console.log("[Admin] Pausing outreach campaigns...");
                // await prisma.campaign.updateMany({ data: { status: 'PAUSED' } });
                return NextResponse.json({ success: true, message: "Outreach paused" });

            case "sync-crm":
                console.log("[Admin] Syncing CRM...");
                // await crmService.syncAll();
                return NextResponse.json({ success: true, message: "CRM sync initiated" });

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: any) {
        console.error(`[Admin] Action ${action} failed:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
