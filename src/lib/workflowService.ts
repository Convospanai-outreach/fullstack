import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { aiService } from "@/modules/ai-content/service/aiService";

export class WorkflowService {
    /**
     * Start a workflow for a specific entity (e.g., Lead)
     */
    static async startWorkflow(workflowId: string, entityId: string, teamId: string) {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId, teamId }
        });

        if (!workflow || !workflow.isActive) return;

        // Create a Run record
        const run = await prisma.workflowRun.create({
            data: {
                workflowId,
                entityId,
                status: "RUNNING",
                context: {}
            }
        });

        // Find the start node (usually the one with no incoming edges or type 'input')
        const nodes = workflow.nodes as any[];
        const startNode = nodes.find(n => n.type === 'input') || nodes[0];

        if (startNode) {
            await this.enqueueNodeProcessing(run.id, startNode.id);
        }
    }

    /**
     * Enqueue a background job to process a specific node
     */
    static async enqueueNodeProcessing(runId: string, nodeId: string, delaySeconds: number = 0) {
        await JobQueue.enqueue("workflow_step", {
            runId,
            nodeId
        }, {
            processAt: new Date(Date.now() + delaySeconds * 1000)
        });
    }

    /**
     * Main execution logic for a single node
     */
    static async processNode(runId: string, nodeId: string) {
        const run = await prisma.workflowRun.findUnique({
            where: { id: runId },
            include: { workflow: true }
        });

        if (!run || run.status !== "RUNNING") return;

        const nodes = run.workflow.nodes as any[];
        const edges = run.workflow.edges as any[];
        const node = nodes.find(n => n.id === nodeId);

        if (!node) {
            await prisma.workflowRun.update({
                where: { id: runId },
                data: { status: "COMPLETED", completedAt: new Date() }
            });
            return;
        }

        try {
            let nextNodeId: string | null = null;
            let delay = 0;

            console.log(`[Workflow] Processing ${node.type} node ${nodeId} for run ${runId}`);

            switch (node.type) {
                case "ai":
                    // Generate AI draft and store in context
                    if (run.entityId) {
                        const lead = await prisma.lead.findUnique({ where: { id: run.entityId } });
                        if (lead) {
                            const draft = await aiService.generateEmailDraft(lead, null, run.workflow.teamId);
                            const newContext = { ...(run.context as any), lastAiDraft: draft };
                            await prisma.workflowRun.update({
                                where: { id: runId },
                                data: { context: newContext }
                            });
                        }
                    }
                    break;

                case "action":
                    if (node.data.actionType === 'EMAIL' && run.entityId) {
                        // Enqueue actual email sending job
                        await JobQueue.enqueue("email_sending", {
                            leadId: run.entityId,
                            campaignId: "workflow-" + run.workflowId,
                            context: run.context
                        });
                    }
                    break;

                case "delay":
                    const delayStr = node.data.delay || "1 day";
                    if (delayStr.includes("min")) delay = parseInt(delayStr) * 60;
                    else if (delayStr.includes("hour")) delay = parseInt(delayStr) * 3600;
                    else delay = parseInt(delayStr) * 86400;
                    break;

                case "condition":
                    // Branching logic
                    const conditionType = node.data.type;
                    let conditionResult = false;

                    if (conditionType === 'REPLIED' && run.entityId) {
                        const lead = await prisma.lead.findUnique({ where: { id: run.entityId } });
                        conditionResult = lead?.status === 'replied';
                    }

                    const targetEdge = edges.find(e => e.source === nodeId && e.sourceHandle === (conditionResult ? "true" : "false"));
                    nextNodeId = targetEdge?.target || null;
                    break;
            }

            // Determine next node if not already set (for non-condition nodes)
            if (node.type !== "condition") {
                const edge = edges.find(e => e.source === nodeId);
                nextNodeId = edge?.target || null;
            }

            if (nextNodeId) {
                await this.enqueueNodeProcessing(runId, nextNodeId, delay);
            } else if (delay === 0) {
                // End of path
                await prisma.workflowRun.update({
                    where: { id: runId },
                    data: { status: "COMPLETED", completedAt: new Date() }
                });
            }

        } catch (error: any) {
            console.error(`[Workflow] Error processing node ${nodeId}:`, error);
            await prisma.workflowRun.update({
                where: { id: runId },
                data: { status: "FAILED", error: error.message }
            });
        }
    }
}
