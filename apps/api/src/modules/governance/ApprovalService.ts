
import { prisma } from "@/lib/db";
import { ApprovalTier, computeAutoDenyAt, resolveApprovalTier } from "./approvalPolicy";
import { getBreakerState } from "@/modules/overseer/breakerService";

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
        options: { reason?: string; requestId?: string; forceHardBlock?: boolean } = {}
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

        const tier = resolveApprovalTier(actionType, { forceHardBlock: options.forceHardBlock });
        const breakerState = await getBreakerState(teamId);
        const extendedTimeout = breakerState !== "CLOSED";

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
                status: ApprovalStatus.PENDING,
                tier,
                autoDenyAt: computeAutoDenyAt(tier, new Date(), extendedTimeout)
            }
        });

        console.log(`[ApprovalService] Request ${request.id} created for ${entityType} ${entityId}: ${actionType} (tier=${tier})`);

        if (tier === ApprovalTier.AUTO) {
            await this.approve(request.id, "system-auto", teamId);
        }

        return { id: request.id, created: true };
    }

    /**
     * Rejects every PENDING, QUEUED-tier request whose autoDenyAt has passed.
     * HARD_BLOCK requests are never touched here - they have no timeout by design.
     */
    static async autoDenyExpiredApprovals(): Promise<number> {
        const expired = await prisma.approvalRequest.findMany({
            where: {
                status: ApprovalStatus.PENDING,
                tier: ApprovalTier.QUEUED,
                autoDenyAt: { lte: new Date() }
            },
            select: { id: true, teamId: true }
        });

        for (const { id, teamId } of expired) {
            await this.reject(id, "system-timeout", teamId, "Auto-denied: no reviewer action within the approval window");
        }

        return expired.length;
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
    static async approve(requestId: string, reviewerId: string, teamId: string, revisedPayload?: any) {
        // Scoped to teamId - without this, any authenticated user could approve/reject
        // another team's pending request by guessing its id, including triggering
        // approve()'s CAMPAIGN_START side-effect on that team's campaign.
        const request = await prisma.approvalRequest.findFirst({ where: { id: requestId, teamId } });
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
    static async reject(requestId: string, reviewerId: string, teamId: string, reason?: string) {
        const request = await prisma.approvalRequest.findFirst({ where: { id: requestId, teamId } });
        if (!request) throw new Error("Request not found");

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
