import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";
import { WorkflowService } from "@/lib/workflowService";

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const authResult = await authorizeApiKey(req, "workflows:run");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const { id: workflowId } = params;

    try {
        const body = await req.json();
        const { entityId, context } = body;

        if (!entityId) {
            return NextResponse.json({ error: "entityId is required" }, { status: 400 });
        }

        // Verify workflow belongs to team
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId, teamId: auth.teamId }
        });

        if (!workflow) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        if (!workflow.isActive) {
            return NextResponse.json({ error: "Workflow is inactive" }, { status: 400 });
        }

        const runId = await WorkflowService.startWorkflow(
            workflowId,
            entityId,
            auth.teamId
        );

        if (!runId) {
            return NextResponse.json({ error: "Workflow could not be started" }, { status: 400 });
        }

        const run = await prisma.workflowRun.findFirst({
            where: { id: runId, workflow: { teamId: auth.teamId } },
        });

        return NextResponse.json({
            success: true,
            runId,
            status: run?.status || "RUNNING"
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
