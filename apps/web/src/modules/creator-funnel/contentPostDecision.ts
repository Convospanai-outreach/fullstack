import { prisma } from "@/lib/db";

// Web copy of apps/api decideContentPost (creator-funnel/contentPostService.ts): Inbox >
// Approvals decides through apps/web's /api/approvals/[id], the auto-deny sweep through
// apps/api. Keep the two in step.
//
// Only a PENDING request moves, and only the post it's currently attached to, so approving a
// stale card after the post was edited changes nothing. An approval that arrives after the
// post's time sends it back to DRAFT instead of publishing late. Returns false when nothing
// changed.
export const CONTENT_POST_ACTION = "CONTENT_POST_PUBLISH";

export async function decideContentPost(
    teamId: string,
    requestId: string,
    reviewerId: string,
    decision: "APPROVED" | "REJECTED",
    note?: string
): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
        const now = new Date();
        const moved = await tx.approvalRequest.updateMany({
            where: { id: requestId, teamId, status: "PENDING", actionType: CONTENT_POST_ACTION },
            data: { status: decision, reviewerId, reviewedAt: now, ...(note ? { reviewNote: note } : {}) },
        });
        if (moved.count !== 1) return false;

        const attached = { teamId, status: "IN_REVIEW" as const, approvalRequestId: requestId };
        if (decision === "REJECTED") {
            await tx.contentPost.updateMany({
                where: attached,
                data: { status: "DRAFT", approvalRequestId: null, reviewNote: note ? `Not approved: ${note}` : "Not approved." },
            });
            return true;
        }
        const approved = await tx.contentPost.updateMany({ where: { ...attached, scheduledAt: { gt: now } }, data: { status: "APPROVED" } });
        if (approved.count === 0) {
            await tx.contentPost.updateMany({
                where: attached,
                data: { status: "DRAFT", approvalRequestId: null, reviewNote: "The scheduled time passed before approval. Pick a new time." },
            });
        }
        return true;
    });
}
