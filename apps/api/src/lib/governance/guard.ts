import { prisma } from "@/lib/db";

export type GovernanceRole = "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER";

export async function enforcePolicy({
    orgId,
    userId,
    action,
    payload,
}: {
    orgId: string
    userId: string
    action: string
    payload?: any
}) {
    const [existingPolicy, membership] = await Promise.all([
        prisma.organizationPolicy.findUnique({
            where: { organizationId: orgId },
        }),
        prisma.teamMember.findFirst({
            where: { teamId: orgId, userId },
        }),
    ]);

    // Membership must be verified before any write to this org's policy -
    // the auto-create below runs unconditionally otherwise, letting a
    // non-member materialize an OrganizationPolicy row for a team they have
    // no relationship to just by calling with that team's id as orgId.
    if (!membership) throw new Error("NOT_A_TEAM_MEMBER");

    // Auto-create a permissive default policy if none exists (new teams)
    const policy = existingPolicy ?? await prisma.organizationPolicy.create({
        data: { organizationId: orgId },
    });

    const role = membership.role.toUpperCase() as GovernanceRole;

    // PART 5 — ROLE-BASED PERMISSIONS (STRICT)
    if (["CHANGE_POLICY", "APPROVE_REQUEST", "PUBLISH_PUBLIC_PLAYBOOK"].includes(action)) {
        if (role !== "OWNER" && role !== "ADMIN") {
            throw new Error("UNAUTHORIZED_ROLE: ONLY_OWNER_OR_ADMIN");
        }
    }

    if (role === "VIEWER" && action !== "READ") {
        throw new Error("UNAUTHORIZED_ROLE: VIEWER_IS_READ_ONLY");
    }

    if (action === "CAMPAIGN_RUN" && role === "VIEWER") {
        throw new Error("UNAUTHORIZED_ROLE: VIEWER_CANNOT_RUN_CAMPAIGN");
    }

    // PART 2 — DETERMINISTIC ENFORCEMENT LAYER
    if (action === "CAMPAIGN_RUN" && policy.requiresApprovalForCampaign) {
        // If approval is required, check if an approved request exists in payload
        if (!payload?.approvalId) {
            throw new Error("APPROVAL_REQUIRED");
        }
        // Must be scoped to this org AND this specific campaign - an unscoped lookup would let
        // any approvalId belonging to a DIFFERENT team's (or a different campaign's) approved
        // request satisfy this org's approval gate.
        const approval = await prisma.approvalRequest.findFirst({
            where: {
                id: payload.approvalId,
                teamId: orgId,
                entityType: "Campaign",
                ...(payload.campaignId ? { entityId: payload.campaignId } : {}),
            },
        });
        if (!approval || approval.status !== "APPROVED") {
            throw new Error("VALID_APPROVAL_REQUIRED");
        }
    }

    if (action === "INMAIL" && !policy.allowInMail) {
        throw new Error("INMAIL_DISABLED_BY_ORG");
    }

    if (action === "SCRAPING" && !policy.allowScraping) {
        throw new Error("SCRAPING_DISABLED_BY_ORG");
    }

    if (action === "UPLOAD" && !policy.allowUploads) {
        throw new Error("UPLOADS_DISABLED_BY_ORG");
    }

    return true;
}
