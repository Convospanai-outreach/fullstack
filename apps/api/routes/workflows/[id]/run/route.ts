import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { WorkflowService } from "@/lib/workflowService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const { leadId } = body || {};
        if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

        const runId = await WorkflowService.startWorkflow(id, leadId, teamId);
        if (!runId) {
            return NextResponse.json({ error: "Workflow not found or inactive" }, { status: 404 });
        }

        return NextResponse.json({ success: true, runId, message: "Workflow triggered" });
    } catch (error: any) {
        console.error("Workflow Trigger Error:", error);
        return NextResponse.json({ error: error.message || "Failed to trigger workflow" }, { status: 400 });
    }
}
