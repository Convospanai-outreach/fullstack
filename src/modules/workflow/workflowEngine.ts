import { prisma } from "@/lib/db";

export class WorkflowEngine {

    /**
     * Starts a workflow for a given entity (e.g. Lead)
     */
    async startWorkflow(workflowId: string, entityId: string, context: any = {}) {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId }
        });

        if (!workflow || !workflow.isActive) {
            throw new Error("Workflow not found or inactive");
        }

        // Parse nodes to find the trigger/start node
        const nodes = workflow.nodes as any[];
        const startNode = nodes.find((n: any) => n.type === 'trigger' || n.type === 'start');

        if (!startNode) {
            throw new Error("No start node found in workflow");
        }

        // Create the run
        const run = await prisma.workflowRun.create({
            data: {
                workflowId,
                entityId,
                status: 'RUNNING',
                currentStepId: startNode.id,
                context
            }
        });

        // Trigger execution of the first step (asynchronously ideally, but direct for now)
        await this.executeStep(run.id);

        return run;
    }

    /**
     * Executes the current step of a WorkflowRun and moves to the next
     */
    async executeStep(runId: string) {
        const run = await prisma.workflowRun.findUnique({
            where: { id: runId },
            include: { workflow: true }
        });

        if (!run || !run.currentStepId || run.status !== 'RUNNING') return;

        const nodes = run.workflow.nodes as any[];
        const edges = run.workflow.edges as any[];
        const currentNode = nodes.find((n: any) => n.id === run.currentStepId);

        if (!currentNode) {
            await this.failRun(runId, "Current node not found in definition");
            return;
        }

        try {
            // 1. Execute Action based on Node Type
            console.log(`[Workflow] Executing step ${currentNode.id} (${currentNode.type}) for run ${runId}`);

            // TODO: Implement actual action logic (e.g. send email, enrich)
            // For now, we just simulate success

            // 2. Determine Next Step
            // Find edges connected to source = currentNode.id
            const outboundEdges = edges.filter((e: any) => e.source === currentNode.id);

            if (outboundEdges.length === 0) {
                // End of flow
                await prisma.workflowRun.update({
                    where: { id: runId },
                    data: { status: 'COMPLETED', completedAt: new Date(), currentStepId: null }
                });
                return;
            }

            // Simple traversal: take the first edge
            // TODO: Handle condition nodes where we pick edge based on result
            const nextNodeId = outboundEdges[0].target;

            // 3. Update Run to Next Step
            await prisma.workflowRun.update({
                where: { id: runId },
                data: { currentStepId: nextNodeId }
            });

            // Recursively execute next step (or queue it)
            // For MVP, we'll just await it to chain (stack depth risk if long flow)
            await this.executeStep(runId);

        } catch (error: any) {
            await this.failRun(runId, error.message);
        }
    }

    private async failRun(runId: string, error: string) {
        await prisma.workflowRun.update({
            where: { id: runId },
            data: { status: 'FAILED', error, completedAt: new Date() }
        });
    }
}

export const workflowEngine = new WorkflowEngine();
