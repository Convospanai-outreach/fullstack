import { NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { createLeadSchema } from "@/lib/validation/schemas";
import { AuditService } from "@/modules/audit/auditService";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { logger } from "@/lib/logger";

// GET /api/leads - List leads with optional filters
export async function GET(req: NextRequest) {
    try {
        const { teamId, userId } = await getCurrentContext();
        if (!teamId || !userId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const campaignId = searchParams.get("campaignId") || "";
        const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
        const offset = parseInt(searchParams.get("offset") || "0");

        const { DbFactory } = await import("@/lib/dbFactory");
        const db = DbFactory.getClient();

        const where: any = { teamId };
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status) where.status = status;
        if (campaignId) where.campaignId = campaignId;

        const [leads, total] = await Promise.all([
            db.lead.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { updatedAt: "desc" },
            }),
            db.lead.count({ where }),
        ]);

        return successResponse({ leads, total });
    } catch (error) {
        return handleAPIError(error);
    }
}

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
            logger.info("[Sovereign Routing] Request routed to UAE Shard", { country: market.country });
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

        const { LeadService } = await import("@/services/LeadService");
        const lead = await LeadService.upsert(teamId, userId, {
            ...validation.data,
            marketContext: market
        });

        return successResponse(lead, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
