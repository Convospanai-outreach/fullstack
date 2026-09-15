import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { tryNormalizeDomain, normalizeCompanyName, getAccountKey } from "@/lib/crm/domain";

const LEAD_SELECT = {
    id: true, fullName: true, jobTitle: true, company: true, domain: true, reportsToId: true,
    pipelineState: true, pipelineStateChangedAt: true,
} as const;

// On-demand account grouping - no Company entity exists, so leads sharing an
// account are found by domain (indexed, exact) when a domain query is given,
// else by the same bounded normalized-company-name scan findLeadForSignal
// uses (netjanaIntelService.ts) since there's no indexed normalized column.
async function findAccountLeads(teamId: string, domainParam: string | null, companyParam: string | null) {
    if (domainParam) {
        const domain = tryNormalizeDomain(domainParam);
        if (!domain) {
            throw new APIError("Enter a valid domain, such as example.com.", 400, "VALIDATION_ERROR");
        }
        return prisma.lead.findMany({ where: { teamId, domain }, select: LEAD_SELECT });
    }

    const targetKey = normalizeCompanyName(companyParam);
    if (!targetKey) {
        throw new APIError("Provide a domain or company to look up an account.", 400, "VALIDATION_ERROR");
    }
    const candidates = await prisma.lead.findMany({
        where: { teamId, company: { not: null } },
        select: LEAD_SELECT,
        take: 400,
    });
    return candidates.filter((lead) => normalizeCompanyName(lead.company) === targetKey);
}

export async function GET(req: NextRequest) {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const { searchParams } = new URL(req.url);
        const leads = await findAccountLeads(teamId, searchParams.get("domain"), searchParams.get("company"));

        return NextResponse.json({ leads });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const body = await req.json();
        const { leadId, reportsToId } = body ?? {};
        if (typeof leadId !== "string") {
            throw new APIError("leadId is required", 400, "VALIDATION_ERROR");
        }
        if (reportsToId !== null && typeof reportsToId !== "string") {
            throw new APIError("reportsToId must be a string lead id or null", 400, "VALIDATION_ERROR");
        }
        if (reportsToId === leadId) {
            throw new APIError("A lead cannot report to itself", 400, "VALIDATION_ERROR");
        }

        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: LEAD_SELECT });
        if (!lead) {
            throw new APIError("Lead not found", 404, "NOT_FOUND");
        }

        if (reportsToId) {
            const manager = await prisma.lead.findFirst({ where: { id: reportsToId, teamId }, select: LEAD_SELECT });
            if (!manager) {
                throw new APIError("reportsToId lead not found", 404, "NOT_FOUND");
            }

            const leadKey = getAccountKey(lead);
            const managerKey = getAccountKey(manager);
            if (!leadKey || !managerKey || leadKey !== managerKey) {
                throw new APIError(
                    "Both leads must belong to the same account to draw a reporting line between them.",
                    400,
                    "CROSS_ACCOUNT_EDGE"
                );
            }
        }

        const updated = await prisma.lead.update({
            where: { id: leadId },
            data: { reportsToId: reportsToId || null },
            select: LEAD_SELECT,
        });

        return NextResponse.json({ lead: updated });
    } catch (error) {
        return handleAPIError(error);
    }
}
