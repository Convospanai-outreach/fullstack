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

        // [SOVEREIGN-ROUTING] Detect Market Context
        const { MarketRoutingMiddleware } = await import("@/lib/middleware/MarketRoutingMiddleware");
        const market = MarketRoutingMiddleware.getContext(req);

        // Log if UAE context is active (Audit Trail)
        if (market.region === 'UAE') {
            console.log(`[Sovereign Routing] Request routed to UAE Shard. Origin: ${market.country}`);
        }

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

        // [SOVEREIGN-SHARDING] Select Correct Database
        const { DbFactory } = await import("@/lib/dbFactory");
        // @ts-ignore - Region mismatch between simple string and enum
        const db = DbFactory.getClient(market.region);

        // Check for duplicate within the team
        if (email) {
            const existing = await db.lead.findFirst({
                where: { email, teamId },
            });

            if (existing) {
                throw new APIError("Lead with this email already exists", 409, "DUPLICATE_LEAD");
            }
        }

        const lead = await db.lead.create({
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
                updatedAt: new Date(),

                // [SOVEREIGN-CONTEXT]
                // @ts-ignore
                regionId: market.region === 'UAE' ? 'UAE' : 'GLOBAL',
                marketContext: {
                    detectedCountry: market.country,
                    routedAt: new Date().toISOString()
                }
            },
        });

        // Audit Log (Always goes to Global/Audit DB? Or Sharded?)
        // For now, keep Audit centralized or assume AuditService handles it.
        await AuditService.log(teamId, userId, "LEAD_SYNCED", "Lead", lead.id, { email: lead.email, region: market.region });

        return successResponse(lead, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
