import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { PipelineAIService } from "@/modules/ai-content/service/PipelineAIService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { leadId, action } = await req.json();

    try {
        let result;
        if (action === "suggestTasks") {
            result = await PipelineAIService.suggestTasks(ctx.teamId, leadId);
        } else if (action === "recommendStage") {
            result = await PipelineAIService.recommendStage(leadId);
        } else if (action === "summarize") {
            result = await PipelineAIService.summarizeLead(leadId);
        }

        return NextResponse.json({ success: true, data: result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
