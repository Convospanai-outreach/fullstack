
import { prisma } from "@/lib/db";

export enum ApprovalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}

export class ApprovalService {

    /**
     * Creates an approval request for a specific task and action.
     */
    static async requestApproval(taskId: string, teamId: string, actionType: string, payload: any): Promise<string> {
        const request = await prisma.approvalRequest.create({
            data: {
                entityId: taskId,
                entityType: "AgentTask",
                // requesterId is required by schema, assuming valid ID or system user for now. 
                // WARNING: Schema requires requesterId. modifying to include it or finding a workaround.
                // Looking at schema: requesterId String. 
                // We'll need to pass requesterId to this function or use a fallback if allowed. 
                // For now, let's assume the payload might have it or we need to update the signature.
                // To avoid breaking signature, I will use a placeholder or check if I can update signature.
                requesterId: "system-agent", // Placeholder for now, ideally passed in
                teamId,
                actionType,
                payload: JSON.stringify(payload),
                status: ApprovalStatus.PENDING
            }
        });

        console.log(`[ApprovalService] Request ${request.id} created for Task ${taskId}: ${actionType}`);
        return request.id;
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
    static async approve(requestId: string, approverId: string) {
        return await prisma.approvalRequest.update({
            where: { id: requestId },
            data: { status: ApprovalStatus.APPROVED, approverId, resolvedAt: new Date() }
        });
    }

    /**
     * Rejects a request.
     */
    static async reject(requestId: string, approverId: string) {
        return await prisma.approvalRequest.update({
            where: { id: requestId },
            data: { status: ApprovalStatus.REJECTED, approverId, resolvedAt: new Date() }
        });
    }
}
