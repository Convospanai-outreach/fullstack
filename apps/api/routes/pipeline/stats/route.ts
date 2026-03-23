import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { PipelineService } from "@/modules/analytics/service/PipelineService";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const stats = await PipelineService.getPipelineStats(ctx.teamId);
        return NextResponse.json({ success: true, data: stats });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
