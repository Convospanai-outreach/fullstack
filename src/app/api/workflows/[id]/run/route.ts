import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { WorkflowService } from "@/lib/workflowService";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { leadId } = await req.json();
        if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

        await WorkflowService.startWorkflow(params.id, leadId, teamId);

        return NextResponse.json({ success: true, message: "Workflow triggered" });
    } catch (error: any) {
        console.error("Workflow Trigger Error:", error);
        return new NextResponse(error.message, { status: 500 });
    }
}
