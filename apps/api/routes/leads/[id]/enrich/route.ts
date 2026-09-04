
import { NextResponse } from "next/server";
import { EnrichmentService } from "@/modules/enrichment/service/EnrichmentService";
import { handleAPIError } from "@/lib/apiResponse";
import { getCurrentContext } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const result = await EnrichmentService.enrichLead(id, teamId);
        if (!result) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }
        return NextResponse.json(result);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
