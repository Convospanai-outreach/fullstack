
import { prisma } from "@/lib/db";

export enum ApprovalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}

export class ApprovalService {

    /**
     * Creates or reuses an approval request for any entity/action pair.
     * This is idempotent for the same entity/action combination.
     */
    static async requestEntityApproval(
        entityType: string,
        entityId: string,
        teamId: string,
        actionType: string,
        payload: any,
        requesterId: string,
        options: { reason?: string; requestId?: string } = {}
    ): Promise<{ id: string; created: boolean }> {
        const existing = await prisma.approvalRequest.findFirst({
            where: {
                teamId,
                entityType,
                entityId,
                actionType
            },
            orderBy: { createdAt: "desc" }
        });

        if (existing) {
            return { id: existing.id, created: false };
        }

        const request = await prisma.approvalRequest.create({
            data: {
                id: options.requestId,
                entityId,
                entityType,
                requesterId,
                teamId,
                actionType,
                payload: payload || {},
                reason: options.reason,
                status: ApprovalStatus.PENDING
            }
        });

        console.log(`[ApprovalService] Request ${request.id} created for ${entityType} ${entityId}: ${actionType}`);
        return { id: request.id, created: true };
    }

    /**
     * Creates an approval request for a specific task and action.
     */
    static async requestApproval(taskId: string, teamId: string, actionType: string, payload: any, requesterId: string = "system-agent"): Promise<string> {
        const request = await this.requestEntityApproval(
            "AgentTask",
            taskId,
            teamId,
            actionType,
            payload,
            requesterId
        );

        return request.id;
    }

    /**
     * Get pending requests for a team
     */
    static async getPendingRequests(teamId: string) {
        return await prisma.approvalRequest.findMany({
            where: {
                teamId,
                status: ApprovalStatus.PENDING
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
     * Checks if a pending request has been approved.
     */
    static async checkStatus(taskId: string): Promise<ApprovalStatus> {
        const request = await prisma.approvalRequest.findFirst({
            where: { entityId: taskId, status: ApprovalStatus.PENDING },
            orderBy: { createdAt: 'desc' }
        });

        if (!request) {
            // Check for recent approval
            const approved = await prisma.approvalRequest.findFirst({
                where: { entityId: taskId, status: ApprovalStatus.APPROVED },
                orderBy: { createdAt: 'desc' }
            });
            return approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED; // Default to blocked if no pending
        }

        return ApprovalStatus.PENDING;
    }

    /**
     * Approves a request (callable via UI/API).
     */
    static async approve(requestId: string, reviewerId: string, revisedPayload?: any) {
        const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new Error("Request not found");

        const updateData: any = { 
            status: ApprovalStatus.APPROVED, 
            reviewerId, 
            reviewedAt: new Date() 
        };

        if (revisedPayload) {
            updateData.reviewNote = JSON.stringify(revisedPayload);
        }

        // Handle specific action side-effects
        if (request.actionType === "CAMPAIGN_START") {
            await prisma.campaign.update({
                where: { id: request.entityId },
                data: { status: "active" }
            });
        }

        return await prisma.approvalRequest.update({
            where: { id: requestId },
            data: updateData
        });
    }

    /**
     * Rejects a request.
     */
    static async reject(requestId: string, reviewerId: string, reason?: string) {
        const data: any = { status: ApprovalStatus.REJECTED, reviewerId, reviewedAt: new Date() };
        if (reason) {
            data.reviewNote = reason;
        }
        return await prisma.approvalRequest.update({
            where: { id: requestId },
            data
        });
    }
}
