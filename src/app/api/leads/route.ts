import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { LeadSchema } from "@/lib/schemas";
import { SearchService } from "@/modules/search/service/SearchService";

// GET /api/leads - List all leads with filtering
export async function GET(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const { searchParams } = new URL(req.url);
        const campaignId = searchParams.get("campaignId") || undefined;
        const status = searchParams.get("status") || undefined;
        const search = searchParams.get("search") || undefined;
        const tags = searchParams.get("tags")?.split(",") || undefined;
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");
        const page = Math.floor(offset / limit) + 1;

        const result = await SearchService.searchLeads({
            teamId,
            query: search,
            status,
            tags,
            campaignId,
        }, page, limit);

        return successResponse({
            leads: result.leads,
            total: result.total,
            limit,
            offset,
            totalPages: result.totalPages
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

// POST /api/leads - Create single lead
export async function POST(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

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

        return successResponse(lead, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
