import { NextResponse } from "next/server";
import { crmService } from "@/modules/crm-integration/service/crmService";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const body = await req.json();
        const { leadId } = body;

        if (!leadId) throw new APIError("Lead ID is required", 400, "BAD_REQUEST");

        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId } });
        if (!lead) throw new APIError("Lead not found", 404, "NOT_FOUND");

        const result = await crmService.syncLead(leadId, teamId);

        return NextResponse.json(result);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
