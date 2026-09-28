import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { recordLeadDataSources } from "@/lib/crm/leadDataSource";
import { parseBody } from "@/lib/validation/parseBody";
import { z } from "zod";

// Value types for the PATCH allowlist below, matching the Lead columns. Unknown
// keys are stripped (they were already ignored by the allowlist); wrong types
// used to reach Prisma and come back as a 500.
const optionalText = z.string().max(2000).nullish();
const patchLeadSchema = z.object({
    fullName: optionalText,
    email: optionalText,
    phone: optionalText,
    linkedIn: optionalText,
    company: optionalText,
    domain: optionalText,
    jobTitle: optionalText,
    location: optionalText,
    status: z.string().min(1).max(64).optional(),
    tags: z.array(z.string().max(200)).optional(),
    crmId: optionalText,
    value: z.number().nullish(),
    consentObtained: z.boolean().optional(),
    whatsappConsent: z.boolean().optional(),
    whatsappConsentAt: z.iso.datetime({ offset: true }).nullish(),
    whatsappConsentBy: optionalText,
    whatsappNumber: optionalText,
    preferredMeetingType: optionalText,
    meetingLocation: optionalText,
});

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
            channelStatuses: true,
            leadActivities: { orderBy: { createdAt: "desc" }, take: 50 },
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
        const { lead: existingLead, teamId } = await requireLeadContext(id, TeamRole.MEMBER);
        const parsed = await parseBody(req, patchLeadSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;

        // STRICT ALLOWLIST: Only user-editable fields are permitted.
        // System-managed fields (pipelineState, intentScore, leadScore, isEnriched,
        // hotAt, lastScoredAt, churnRisk, clusterLabel, optimalSendHour, etc.)
        // must be updated through their dedicated service methods, not via direct PATCH.
        const ALLOWED_PATCH_FIELDS = new Set([
            "fullName", "email", "phone", "linkedIn",
            "company", "domain", "jobTitle", "location",
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

        const changedFields = Object.entries(safeData).filter(
            ([key, val]) => (existingLead as any)[key] !== val
        );
        if (changedFields.length > 0) {
            await recordLeadDataSources(
                changedFields.map(([field, value]) => ({
                    leadId: id,
                    field,
                    source: "MANUAL" as const,
                    value: value === null || value === undefined ? "" : String(value),
                }))
            );
        }

        const lead = await prisma.lead.findFirst({
            where: { id, teamId },
            include: { campaign: true, channelStatuses: true, leadActivities: { orderBy: { createdAt: "desc" }, take: 50 } },
        });

        return NextResponse.json(lead);
    } catch (error) {
        return handleAPIError(error);
    }
}
