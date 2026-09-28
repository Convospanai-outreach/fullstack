import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { PIPELINE_STAGES, PipelineService } from "@/modules/analytics/service/PipelineService";
import { parseBody } from "@/lib/validation/parseBody";
import { z } from "zod";

// An unknown stage or a non-numeric dealValue used to surface as a 500 (thrown
// by moveLead / Prisma); both are client errors.
const moveLeadSchema = z.object({
    status: z.enum(PIPELINE_STAGES),
    dealValue: z.number().optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    const { leadId } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { leadId } = await params;
        const parsed = await parseBody(req, moveLeadSchema);
        if (!parsed.ok) return parsed.response;
        const { status, dealValue } = parsed.data;
        const updated = await PipelineService.moveLead(ctx.teamId, leadId, status, dealValue);
        return NextResponse.json({ success: true, data: updated });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
