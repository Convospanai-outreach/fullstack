import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { PipelineService, PipelineStage } from "@/modules/analytics/service/PipelineService";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    const { leadId } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { leadId } = await params;
        const { status, dealValue } = await req.json();
        const updated = await PipelineService.moveLead(ctx.teamId, leadId, status as PipelineStage, dealValue);
        return NextResponse.json({ success: true, data: updated });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
