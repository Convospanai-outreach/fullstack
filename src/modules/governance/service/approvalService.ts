import { prisma } from "@/lib/db";

export class ApprovalService {
    /**
     * Create a new approval request
     */
    static async createRequest(
        teamId: string,
        userId: string,
        actionType: string,
        entityType: string,
        entityId: string,
        reason?: string,
        payload?: any
    ) {
        const data: any = {
            teamId,
            requesterId: userId,
            actionType,
            entityType,
            entityId,
            payload: payload || {},
            status: "PENDING"
        };
        if (reason) {
            data.reason = reason;
        }
        return await prisma.approvalRequest.create({ data });
    }

    /**
     * Get pending requests for a team
     */
    static async getPendingRequests(teamId: string) {
        return await prisma.approvalRequest.findMany({
            where: {
                teamId,
                status: "PENDING"
            },
            include: {
                requester: {
                    select: {
                        name: true,
                        email: true,
                        image: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
    }

    /**
     * Approve a request
     */
    static async approveRequest(requestId: string, reviewerId: string) {
        const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new Error("Request not found");
        if (request.status !== "PENDING") throw new Error("Request already processed");

        // Perform the action based on type
        if (request.actionType === "CAMPAIGN_START") {
            await prisma.campaign.update({
                where: { id: request.entityId },
                data: { status: "active" }
            });
        }

        // HITL Logic: Resume Agent
        if (request.actionType === "AGENT_ACTION" && request.entityType === "AgentTask") {
            // 1. Update Task status back to EXECUTING
            await prisma.agentTask.update({
                where: { id: request.entityId },
                data: { status: "EXECUTING" } // AgentExecutor will pick this up next cycle
            });

            // 2. Log system event
            await prisma.agentLog.create({
                data: {
                    taskId: request.entityId,
                    type: "SYSTEM",
                    content: "Action Approved by Human Reviewer. Resuming execution.",
                    stepNumber: 0 // Out of band
                }
            });
        }

        return await prisma.approvalRequest.update({
            where: { id: requestId },
            data: {
                status: "APPROVED",
                reviewerId,
                reviewedAt: new Date()
            }
        });
    }

    /**
     * Reject a request
     */
    static async rejectRequest(requestId: string, reviewerId: string, reason?: string) {
        const data: any = {
            status: "REJECTED",
            reviewerId,
            reviewedAt: new Date()
        };
        if (reason) {
            data.reviewNote = reason;
        }

        // HITL Logic: Halt/Replan Agent
        // First fetch the request to check its type (if we don't already have it, but here we only have ID)
        const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });

        if (request && request.actionType === "AGENT_ACTION" && request.entityType === "AgentTask") {
            // 1. Update Task status back to PLANNING (force re-think)
            await prisma.agentTask.update({
                where: { id: request.entityId },
                data: { status: "PLANNING" }
            });

            // 2. Log system event
            await prisma.agentLog.create({
                data: {
                    taskId: request.entityId,
                    type: "SYSTEM",
                    content: `Action Rejected by Human Reviewer: ${reason || "No reason given"}. Please refine plan.`,
                    stepNumber: 0
                }
            });
        }

        return await prisma.approvalRequest.update({
            where: { id: requestId },
            data
        });
    }
}
