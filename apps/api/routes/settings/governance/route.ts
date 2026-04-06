import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";
import { APIError, handleAPIError } from "@/lib/apiResponse";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return handleAPIError(new APIError("Unauthorized", 401, "UNAUTHORIZED"));
    }

    try {
        const { Permission, authorizePermission } = await import("@/lib/permissions");
        await authorizePermission(userId, teamId, Permission.MANAGE_POLICY);

        let policy = await prisma.organizationPolicy.findUnique({
            where: { organizationId: teamId }
        });

        // Initialize if not exists
        if (!policy) {
            policy = await prisma.organizationPolicy.create({
                data: { organizationId: teamId }
            });
        }

        return NextResponse.json(policy);
    } catch (error: any) {
        console.error("[Governance API] GET error:", error);
        return handleAPIError(error);
    }
}

export async function PUT(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return handleAPIError(new APIError("Unauthorized", 401, "UNAUTHORIZED"));
    }

    // RBAC: Granular Permission Check
    try {
        const { Permission, authorizePermission } = await import("@/lib/permissions");
        await authorizePermission(userId, teamId, Permission.MANAGE_POLICY);

        const body = await req.json();

        // Sanitize white-list of fields
        const {
            maxDailyActions,
            maxCampaigns,
            maxAgents,
            allowInMail,
            allowScraping,
            allowUploads,
            requiresApprovalForCampaign,
            blockedKeywords,
            detectPII,
            restrictedTone
        } = body;

        const updateData: any = {};
        if (typeof maxDailyActions === 'number') updateData.maxDailyActions = maxDailyActions;
        if (typeof maxCampaigns === 'number') updateData.maxCampaigns = maxCampaigns;
        if (typeof maxAgents === 'number') updateData.maxAgents = maxAgents;
        if (typeof allowInMail === 'boolean') updateData.allowInMail = allowInMail;
        if (typeof allowScraping === 'boolean') updateData.allowScraping = allowScraping;
        if (typeof allowUploads === 'boolean') updateData.allowUploads = allowUploads;
        if (typeof requiresApprovalForCampaign === 'boolean') updateData.requiresApprovalForCampaign = requiresApprovalForCampaign;
        if (Array.isArray(blockedKeywords)) updateData.blockedKeywords = blockedKeywords;
        if (typeof detectPII === 'boolean') updateData.detectPII = detectPII;
        if (typeof restrictedTone === 'string') updateData.restrictedTone = restrictedTone;

        const updatedPolicy = await prisma.organizationPolicy.update({
            where: { organizationId: teamId },
            data: updateData
        });

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "UPDATE_POLICY",
            entity: "OrganizationPolicy",
            entityId: updatedPolicy.id,
            metadata: body
        });

        return NextResponse.json(updatedPolicy);
    } catch (error: any) {
        console.error("[Governance API] PUT error:", error);
        return handleAPIError(error);
    }
}
