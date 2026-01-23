import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { createLeadSchema } from "@/lib/validation/schemas";
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
        const validation = createLeadSchema.safeParse(body);
        if (!validation.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        // Destructure all validated fields
        const {
            fullName,
            email,
            linkedIn,
            phone,
            company,
            jobTitle,
            location,
            status,
            pipelineState,
            tags,
            crmId,
            value,
            campaignId
        } = validation.data;

        if (!email && !linkedIn) {
            throw new APIError("Either Email or LinkedIn URL is required", 400, "VALIDATION_ERROR");
        }

        // Check for duplicate within the team
        if (email) {
            const existing = await prisma.lead.findFirst({
                where: { email, teamId },
            });

            if (existing) {
                throw new APIError("Lead with this email already exists", 409, "DUPLICATE_LEAD");
            }
        }

        const lead = await prisma.lead.create({
            data: {
                fullName: fullName || null,
                email: email || null,
                linkedIn: linkedIn || null,
                phone: phone || null,
                company: company || null,
                jobTitle: jobTitle || null,
                location: location || null,
                status: (status as any) || "NEW",
                // @ts-ignore - Field exists in schema but generated client is stale
                pipelineState: (pipelineState as any) || "COLD",
                tags: tags || [],
                crmId: crmId || null,
                value: value || 0.0,
                campaignId: campaignId || null,
                teamId, // Assign to current team
                updatedAt: new Date()
            },
        });

        // Audit Log
        await AuditService.log(teamId, userId, "LEAD_SYNCED", "Lead", lead.id, { email: lead.email });

        return successResponse(lead, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
