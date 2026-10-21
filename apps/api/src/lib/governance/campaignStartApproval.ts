import { prisma } from "@/lib/db";

/**
 * The APPROVED CAMPAIGN_START request for a campaign, if any. The request itself is filed by
 * the web app's campaign start routes (apps/web/src/lib/governance/campaignStartApproval.ts).
 */
export async function findApprovedCampaignStartId(teamId: string, campaignId: string): Promise<string | null> {
    const approval = await prisma.approvalRequest.findFirst({
        where: { teamId, entityType: "Campaign", entityId: campaignId, actionType: "CAMPAIGN_START", status: "APPROVED" },
        select: { id: true },
    });
    return approval?.id ?? null;
}

/**
 * True when the team's policy requires approval to start campaigns and this campaign has none.
 * A team with no policy row is unrestricted; a missing campaignId can never be approved.
 */
export async function campaignStartNeedsApproval(teamId: string, campaignId: unknown): Promise<boolean> {
    const policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: teamId },
        select: { requiresApprovalForCampaign: true },
    });
    if (!policy?.requiresApprovalForCampaign) return false;
    if (typeof campaignId !== "string" || !campaignId) return true;
    return (await findApprovedCampaignStartId(teamId, campaignId)) === null;
}

// Team roles that hold Permission.RESOLVE_APPROVALS (see lib/permissions).
const APPROVER_ROLES = ["owner", "admin"];

/**
 * True when the reviewer filed this campaign start request themselves and another active owner
 * or admin could approve it instead. A team whose only approver is the requester can still
 * approve its own starts, so turning the policy on never leaves its campaigns stuck.
 */
export async function isBlockedSelfApproval(
    approval: { teamId: string; actionType: string; requesterId: string | null },
    reviewerId: string
): Promise<boolean> {
    if (approval.actionType !== "CAMPAIGN_START" || approval.requesterId !== reviewerId) return false;
    const otherApprovers = await prisma.teamMember.count({
        where: { teamId: approval.teamId, status: "active", role: { in: APPROVER_ROLES }, userId: { not: reviewerId } },
    });
    return otherApprovers > 0;
}
