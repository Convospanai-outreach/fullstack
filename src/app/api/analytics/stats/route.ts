import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { analyticsService } from "@/modules/analytics/service/analyticsService";

export async function GET(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await authorizeRole(userId, teamId, TeamRole.VIEWER);

        const stats = await analyticsService.getStats(teamId);

        // Add funnel and cohort if not already separate, but stats is usually a summary
        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("Error fetching stats:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
