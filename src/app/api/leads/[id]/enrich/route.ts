
import { NextResponse } from "next/server";
import { EnrichmentService } from "@/modules/enrichment/service/EnrichmentService";
import { handleAPIError } from "@/lib/apiResponse";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const lead = await EnrichmentService.enrichLead(params.id);
        return NextResponse.json(lead);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
