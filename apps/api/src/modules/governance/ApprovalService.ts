
import { prisma } from "@/lib/db";
import { ApprovalTier, computeAutoDenyAt, resolveApprovalTier } from "./approvalPolicy";
import { getBreakerState } from "@/modules/overseer/breakerService";

export enum ApprovalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}

// How long before autoDenyAt a QUEUED approval is treated as "expiring soon".
// The pre-deny warning digest below uses it; the Approvals UI mirrors the same
// window for its "Expiring soon" badge (apps/web approvals/page.tsx).
const EXPIRY_WARN_WINDOW_MS = 6 * 60 * 60 * 1000;

// A human accept/reject on an AI-drafted piece of content (currently the only
// approvals carrying `draftEmailId` in their payload - see intel-followup-worker.ts
// and landing-agent/service.ts) is exactly the signal the learning/feedback loop
// was built to consume but never received - see routes/learning/record-feedback,
// which requires a Generation row this flow doesn't produce. Records it as a
// SystemEvent instead of forcing that mismatched dependency. Best-effort: a
// feedback-recording failure must never fail the approve/reject action itself.
async function recordDraftFeedback(request: { entityType: string; entityId: string; payload: unknown }, teamId: string, feedbackType: "APPROVED" | "REJECTED") {
    const draftEmailId = (request.payload as any)?.draftEmailId;
    if (!draftEmailId) return;
    try {
        const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
        await EventStore.record({
            type: SystemEventType.USER,
            name: "DRAFT_FEEDBACK_RECEIVED",
            teamId,
            payload: {
                draftEmailId,
                feedbackType,
                entityType: request.entityType,
                entityId: request.entityId,
            },
        });
    } catch {
        // best-effort
    }
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
     * Warns approvers (team OWNER/ADMIN, who hold RESOLVE_APPROVALS) when QUEUED
     * requests are within EXPIRY_WARN_WINDOW_MS of auto-denying, so a campaign
     * doesn't silently stall because a reviewer missed a day (F-07). At most one
     * digest per approver per window, deduped via the notification's `meta.kind`
     * so the recurring sweep doesn't re-warn on every tick. Best-effort: a
     * notification failure must never break the sweep.
     * @returns the number of warning notifications sent.
     */
    static async warnExpiringApprovals(now: Date = new Date()): Promise<number> {
        const windowEnd = new Date(now.getTime() + EXPIRY_WARN_WINDOW_MS);
        const expiring = await prisma.approvalRequest.findMany({
            where: {
                status: ApprovalStatus.PENDING,
                tier: ApprovalTier.QUEUED,
                autoDenyAt: { gt: now, lte: windowEnd }
            },
            select: { teamId: true }
        });

        if (expiring.length === 0) return 0;

        const countByTeam = new Map<string, number>();
        for (const { teamId } of expiring) {
            countByTeam.set(teamId, (countByTeam.get(teamId) ?? 0) + 1);
        }

        const dedupeSince = new Date(now.getTime() - EXPIRY_WARN_WINDOW_MS);
        const windowHours = EXPIRY_WARN_WINDOW_MS / (60 * 60 * 1000);
        let warned = 0;

        for (const [teamId, count] of countByTeam) {
            const approvers = await prisma.teamMember.findMany({
                where: { teamId, status: "active", role: { in: ["owner", "admin"] } },
                select: { userId: true }
            });

            for (const { userId } of approvers) {
                if (!userId) continue;

                // Skip if this approver already got an expiry warning this window.
                const alreadyWarned = await prisma.notification.findFirst({
                    where: {
                        userId,
                        createdAt: { gt: dedupeSince },
                        meta: { path: ["kind"], equals: "approval_expiry_warning" }
                    },
                    select: { id: true }
                });
                if (alreadyWarned) continue;

                try {
                    const { notificationService } = await import("@/modules/notifications/service/notificationService");
                    await notificationService.sendAlert(
                        userId,
                        "warning",
                        `${count} approval request${count === 1 ? "" : "s"} will auto-deny within ${windowHours}h. Review them before they expire.`,
                        { kind: "approval_expiry_warning", teamId, count }
                    );
                    warned++;
                } catch (err) {
                    console.error(`[ApprovalService] Failed to warn approver ${userId} of expiring approvals:`, err);
                }
            }
        }

        return warned;
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

        // Handle specific action side-effects. Scoped by teamId for defense-in-depth,
        // even though entityId already came from this team-scoped request row above.
        if (request.actionType === "CAMPAIGN_START") {
            await prisma.campaign.updateMany({
                where: { id: request.entityId, teamId },
                data: { status: "active" }
            });
        }

        // Scoped by teamId here too, not just in the pre-check above - same anti-pattern
        // already fixed under OPEN-99/109/110/118/120/121/122.
        await prisma.approvalRequest.updateMany({
            where: { id: requestId, teamId },
            data: updateData
        });
        await recordDraftFeedback(request, teamId, "APPROVED");
        return prisma.approvalRequest.findFirst({ where: { id: requestId, teamId } });
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
        // Scoped by teamId here too, not just in the pre-check above - same anti-pattern
        // already fixed under OPEN-99/109/110/118/120/121/122.
        await prisma.approvalRequest.updateMany({
            where: { id: requestId, teamId },
            data
        });
        await recordDraftFeedback(request, teamId, "REJECTED");
        return prisma.approvalRequest.findFirst({ where: { id: requestId, teamId } });
    }
}
