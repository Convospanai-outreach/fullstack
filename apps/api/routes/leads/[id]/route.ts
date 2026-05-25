import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

async function requireLeadContext(id: string, requiredRole: TeamRole) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    await authorizeRole(userId, teamId, requiredRole);

    const lead = await prisma.lead.findFirst({
        where: { id, teamId },
        include: {
            campaign: true,
        },
    });

    if (!lead) {
        throw new APIError("Lead not found", 404, "NOT_FOUND");
    }

    return { lead, teamId };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { lead } = await requireLeadContext(id, TeamRole.MEMBER);
        return NextResponse.json(lead);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId } = await requireLeadContext(id, TeamRole.MEMBER);
        const body = await req.json();

        // STRICT ALLOWLIST: Only user-editable fields are permitted.
        // System-managed fields (pipelineState, intentScore, leadScore, isEnriched,
        // hotAt, lastScoredAt, churnRisk, clusterLabel, optimalSendHour, etc.)
        // must be updated through their dedicated service methods, not via direct PATCH.
        const ALLOWED_PATCH_FIELDS = new Set([
            "fullName", "email", "phone", "linkedIn",
            "company", "jobTitle", "location",
            "status", "tags", "crmId", "value",
            "consentObtained",
            "whatsappConsent", "whatsappConsentAt", "whatsappConsentBy", "whatsappNumber",
            "preferredMeetingType", "meetingLocation",
        ]);

        const safeData: Record<string, any> = {};
        for (const [key, val] of Object.entries(body ?? {})) {
            if (ALLOWED_PATCH_FIELDS.has(key)) {
                safeData[key] = val;
            }
        }

        if (Object.keys(safeData).length === 0) {
            throw new APIError("No valid fields supplied for update", 400, "VALIDATION_ERROR");
        }

        const updateResult = await prisma.lead.updateMany({
            where: { id, teamId },
            data: safeData
        });

        if (updateResult.count !== 1) {
            throw new APIError("Lead not found", 404, "NOT_FOUND");
        }

        const lead = await prisma.lead.findFirst({
            where: { id, teamId },
            include: { campaign: true },
        });

        return NextResponse.json(lead);
    } catch (error) {
        return handleAPIError(error);
    }
}
