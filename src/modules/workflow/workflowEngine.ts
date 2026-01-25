import { prisma } from "@/lib/db";
import { guardrailService } from "@/modules/governance/service/guardrailService";
import { logger } from "@/lib/logger";
import { WorkflowNode, WorkflowEdge } from "./types";

export class WorkflowEngine {

    /**
     * Starts a workflow for a given entity (e.g. Lead)
     */
    async startWorkflow(workflowId: string, entityId: string, context: Record<string, any> = {}) {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId }
        });

        if (!workflow || !workflow.isActive) {
            throw new Error("Workflow not found or inactive");
        }

        // Parse nodes to find the trigger/start node
        const nodes = (workflow.nodes as unknown) as WorkflowNode[];
        const startNode = nodes.find((n) => n.type === 'trigger' || n.type === 'start');

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

        // Trigger execution of the first step
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

        const nodes = (run.workflow.nodes as unknown) as WorkflowNode[];
        const edges = (run.workflow.edges as unknown) as WorkflowEdge[];
        const teamId = run.workflow.teamId;
        const currentNode = nodes.find((n) => n.id === run.currentStepId);

        if (!currentNode) {
            await this.failRun(runId, `Current node ${run.currentStepId} not found in definition`);
            return;
        }

        try {
            // 1. HITL (Human-in-the-Loop) Intercept
            const nodeData = currentNode.data || {};
            if (nodeData.requiresApproval && (run.status as any) !== 'APPROVED_FOR_STEP') {
                // Pause execution and create approval request
                await prisma.workflowRun.update({
                    where: { id: runId },
                    data: { status: 'AWAITING_APPROVAL' }
                });

                // Fetch a system actor (team admin) to attribute the request to
                const adminMember = await prisma.teamMember.findFirst({
                    where: { teamId, role: { in: ['OWNER', 'ADMIN'] } },
                    select: { userId: true }
                });

                if (!adminMember || !adminMember.userId) {
                    await this.failRun(runId, "No active admin found to assign approval request to");
                    return;
                }

                await prisma.approvalRequest.create({
                    data: {
                        teamId,
                        actionType: 'WORKFLOW_STEP',
                        entityType: 'WORKFLOW_RUN',
                        entityId: runId,
                        status: 'PENDING',
                        requesterId: adminMember.userId,
                        reason: `Workflow step requires approval`,
                        payload: {
                            runId,
                            stepId: currentNode.id,
                            nodeType: currentNode.type,
                            context: (run.context as Record<string, any>) || {}
                        }
                    }
                });

                logger.info(`[Workflow] Step ${currentNode.id} requires approval. Pausing run ${runId}`, { runId, nodeId: currentNode.id });
                return;
            }

            // 2. Guardrail Check (Pre-execution Safety)
            const contextString = JSON.stringify(run.context || {});

            if (contextString.length > 2) {
                const safetyCheck = await guardrailService.evaluate(teamId, contextString);

                if (!safetyCheck.isSafe) {
                    const primaryViolation = safetyCheck.violations[0]!;
                    logger.warn(`[Workflow] Guardrail violation in run ${runId}: ${primaryViolation.reason}`, { runId, violation: primaryViolation });

                    await this.failRun(runId, `Guardrail Blocked: ${primaryViolation.reason}`);
                    return;
                }
            }

            // 3. Execute Action based on Node Type
            logger.info(`[Workflow] Executing step ${currentNode.id} (${currentNode.type}) for run ${runId}`, { runId, nodeId: currentNode.id, type: currentNode.type });


            // EXECUTE ACTION LOGIC
            if (currentNode.type === 'action') {
                const actionType = nodeData.actionType;

                if (actionType === 'enrich_lead') {
                    // Assume entityId is leadId
                    const { EnrichmentService } = await import("@/modules/enrichment/service/EnrichmentService");
                    await EnrichmentService.enrichLead(run.entityId as string);
                }
                else if (actionType === 'send_email') {
                    const { emailService } = await import("@/modules/email-campaigner/service/emailService");

                    // Fetch Lead email
                    const lead = await prisma.lead.findUnique({ where: { id: run.entityId as string } });
                    if (lead && lead.email) {
                        await emailService.sendEmail(
                            lead.email,
                            nodeData.subject || "Hello",
                            nodeData.body || "Default message",
                            { leadId: lead.id, campaignId: (run.context as any)?.campaignId }
                        );
                    }
                }
                else if (actionType === 'wait' || actionType === 'delay') {
                    const delayMs = nodeData.duration || 1000;
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            else if (currentNode.type === 'agent_task') {
                // --- AGENTIC WORKFLOW STEP ---
                const { agentExecutor } = await import("@/modules/agent/core/AgentExecutor");
                const goal = nodeData.goal || `Process entity ${run.entityId}`;

                logger.info(`[Workflow] Starting Agent Task for run ${runId}: ${goal}`);

                const taskId = await agentExecutor.startTask(teamId, goal, {
                    ...run.context as object,
                    leadId: run.entityId,
                    workflowRunId: run.id
                });

                // Run synchronously for now (in production, this would be queue-based)
                const result = await agentExecutor.runToCompletion(taskId);

                if (result !== 'COMPLETED') {
                    await this.failRun(runId, `Agent Task failed or timed out. Status: ${result}`);
                    return;
                }

                logger.info(`[Workflow] Agent Task ${taskId} completed successfully.`);
            }
            else if (currentNode.type === 'delay') {
                const delayMs = nodeData.duration || 1000;
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }


            // 4. Determine Next Step
            const outboundEdges = edges.filter((e: any) => e.source === currentNode.id);

            if (outboundEdges.length === 0) {
                // End of flow
                await prisma.workflowRun.update({
                    where: { id: runId },
                    data: { status: 'COMPLETED', completedAt: new Date(), currentStepId: null }
                });
                return;
            }

            let nextNodeId: string;
            if (currentNode.type === 'condition') {
                // Condition Node Logic
                const ctx = run.context as Record<string, any>;
                const field = nodeData.field;
                const operator = nodeData.operator;
                const value = nodeData.value;

                let result = false;
                if (field) {
                    if (operator === 'eq') result = ctx[field] == value;
                    else if (operator === 'contains') result = String(ctx[field] || "").includes(String(value));
                    else if (operator === 'neq') result = ctx[field] != value;
                    else result = !!ctx[field];
                }

                const handleId = result ? 'true' : 'false';
                const selectedEdge = outboundEdges.find((e) => e.sourceHandle === handleId);
                nextNodeId = selectedEdge ? selectedEdge.target : (outboundEdges[0]?.target || "");
            } else {
                nextNodeId = outboundEdges[0]?.target || "";
            }

            // 5. Update Run to Next Step
            await prisma.workflowRun.update({
                where: { id: runId },
                data: { currentStepId: nextNodeId }
            });

            // Recursively execute next step
            await this.executeStep(runId);

        } catch (error: any) {
            await this.failRun(runId, error.message);
        }
    }

    async resumeRun(runId: string, approved: boolean) {
        if (!approved) {
            await this.failRun(runId, "Step rejected by human reviewer");
            return;
        }

        await prisma.workflowRun.update({
            where: { id: runId },
            data: { status: 'APPROVED_FOR_STEP' }
        });

        await this.executeStep(runId);
    }

    private async failRun(runId: string, error: string) {
        logger.error(`[Workflow] Run ${runId} failed: ${error}`, { runId, error });
        await prisma.workflowRun.update({
            where: { id: runId },
            data: { status: 'FAILED', error, completedAt: new Date() }
        });
    }
}

export const workflowEngine = new WorkflowEngine();
