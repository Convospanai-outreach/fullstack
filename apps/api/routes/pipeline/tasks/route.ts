import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { PipelineService } from "@/modules/analytics/service/PipelineService";

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    try {
        const tasks = await PipelineService.getTasks(ctx.teamId, leadId || undefined);
        return NextResponse.json({ success: true, data: tasks });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const task = await PipelineService.createTask({
            ...body,
            userId: ctx.userId,
            teamId: ctx.teamId
        });
        return NextResponse.json({ success: true, data: task });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
