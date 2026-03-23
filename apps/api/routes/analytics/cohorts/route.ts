import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { analyticsService } from "@/modules/analytics/service/analyticsService";

export async function GET(_req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await authorizeRole(userId, teamId, TeamRole.VIEWER);

        const stats = await analyticsService.getCohortAnalysis(teamId);

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("Error fetching cohort stats:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
