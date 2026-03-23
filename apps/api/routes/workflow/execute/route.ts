import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { WorkflowService } from "@/lib/workflowService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { workflowId, payload } = body;
    const leadId = payload?.leadId || payload?.entityId;
    if (!workflowId || !leadId) return NextResponse.json({ error: "workflowId and payload.leadId required" }, { status: 400 });

    const runId = await WorkflowService.startWorkflow(workflowId, leadId, ctx.teamId);
    if (!runId) return NextResponse.json({ error: "Workflow not active or not found" }, { status: 400 });
    return NextResponse.json({ status: "RUNNING", executionId: runId });
}
