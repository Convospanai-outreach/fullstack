import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { analyticsService } from "@/modules/analytics/service/analyticsService";
import { Permission, authorizePermission } from "@/lib/permissions";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // RBAC: Need VIEW_AUDIT to see governance analytics
        await authorizePermission(userId, teamId, Permission.VIEW_AUDIT);

        const stats = await analyticsService.getGovernanceStats(teamId);
        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("[Governance Analytics API] GET error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
