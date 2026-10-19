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
