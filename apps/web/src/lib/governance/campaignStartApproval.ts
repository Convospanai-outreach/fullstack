import { prisma } from "@/lib/db";
import { computeAutoDenyAt, resolveApprovalTier } from "@/modules/governance/approvalPolicy";

export type CampaignStartGate =
    | { allowed: true }
    | { allowed: false; status: 202; body: { status: "pending_approval"; approvalId: string; message: string } };

const ACTION_TYPE = "CAMPAIGN_START";
const PENDING_MESSAGE = "This team requires approval before a campaign starts. An approval request is waiting for an admin; start the campaign again once it is approved.";

/**
 * Enforces OrganizationPolicy.requiresApprovalForCampaign for the routes that start a
 * campaign. A no-op unless the team turned the policy on (and, unlike governance/guard's
 * enforcePolicy, a team with no policy row is simply unrestricted rather than an error).
 *
 * With the policy on, a start needs an APPROVED CAMPAIGN_START request for that campaign.
 * Otherwise the existing PENDING request is reported, or a new one is filed - also after a
 * rejection or an auto-deny, which would otherwise leave the campaign unstartable for good.
 */
export async function checkCampaignStartApproval({
    teamId,
    userId,
    campaignId,
}: {
    teamId: string;
    userId: string;
    campaignId: string;
}): Promise<CampaignStartGate> {
    const policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: teamId },
        select: { requiresApprovalForCampaign: true },
    });
    if (!policy?.requiresApprovalForCampaign) return { allowed: true };

    const latest = await prisma.approvalRequest.findFirst({
        where: { teamId, entityType: "Campaign", entityId: campaignId, actionType: ACTION_TYPE },
        orderBy: { createdAt: "desc" },
    });
    if (latest?.status === "APPROVED") return { allowed: true };
    if (latest?.status === "PENDING") {
        return { allowed: false, status: 202, body: { status: "pending_approval", approvalId: latest.id, message: PENDING_MESSAGE } };
    }

    const tier = resolveApprovalTier(ACTION_TYPE);
    const created = await prisma.approvalRequest.create({
        data: {
            teamId,
            requesterId: userId,
            entityType: "Campaign",
            entityId: campaignId,
            actionType: ACTION_TYPE,
            status: "PENDING",
            tier,
            autoDenyAt: computeAutoDenyAt(tier),
            reason: "Campaign start requires approval under this team's policy",
            payload: { campaignId },
        },
    });
    return { allowed: false, status: 202, body: { status: "pending_approval", approvalId: created.id, message: PENDING_MESSAGE } };
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
