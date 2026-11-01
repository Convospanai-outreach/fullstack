import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parseBody";
import { contentError, creatorContext } from "@/modules/creator-funnel/contentRoutes";

// Instagram DM flows: list the team's active flows and create one. The steps are checked by the
// service (validateFlowSteps and the custom property keys), so this only checks the envelope.
export const createDmFlowSchema = z.object({
    name: z.string().trim().min(1).max(100),
    steps: z.array(z.unknown()).max(12),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await creatorContext(req, "read");
        if (ctx instanceof NextResponse) return ctx;
        const { listDmFlows } = await import("@/modules/creator-funnel/dmFlowService");
        return NextResponse.json({ flows: await listDmFlows(ctx.teamId) });
    } catch (error) {
        return contentError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await creatorContext(req, "write");
        if (ctx instanceof NextResponse) return ctx;
        const parsed = await parseBody(req, createDmFlowSchema);
        if (!parsed.ok) return parsed.response;
        const { createDmFlow } = await import("@/modules/creator-funnel/dmFlowService");
        return NextResponse.json({ flow: await createDmFlow(ctx.teamId, ctx.userId, parsed.data) }, { status: 201 });
    } catch (error) {
        return contentError(error);
    }
}
