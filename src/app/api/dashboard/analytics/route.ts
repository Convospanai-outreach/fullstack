import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { analyticsService } from "@/modules/analytics/service/analyticsService";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [stats, funnel, forecast] = await Promise.all([
            analyticsService.getStats(ctx.teamId),
            analyticsService.getFunnelStats(ctx.teamId),
            analyticsService.getForecastingStats(ctx.teamId)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                ...stats,
                funnel,
                forecast
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
