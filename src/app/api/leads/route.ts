import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { LeadSchema } from "@/lib/schemas";
import { SearchService } from "@/modules/search/service/SearchService";
import { AuditService } from "@/modules/audit/auditService";
import { authorizeRole, TeamRole } from "@/lib/permissions";

// POST /api/leads - Create single lead
export async function POST(req: NextRequest) {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const body = await req.json();

        // Validate input
        const validation = LeadSchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const { fullName, email, linkedIn, status, campaignId } = validation.data;

        // Check for duplicate within the team
        const existing = await prisma.lead.findFirst({
            where: { email, teamId },
        });

        if (existing) {
            throw new APIError("Lead with this email already exists", 409, "DUPLICATE_LEAD");
        }

        const lead = await prisma.lead.create({
            data: {
                fullName: fullName || null,
                email,
                linkedIn: linkedIn || null,
                status: status || "new",
                campaignId: campaignId || null,
                teamId, // Assign to current team
            },
        });

        // Audit Log
        await AuditService.log(teamId, userId, "LEAD_SYNCED", "Lead", lead.id, { email: lead.email });

        return successResponse(lead, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
