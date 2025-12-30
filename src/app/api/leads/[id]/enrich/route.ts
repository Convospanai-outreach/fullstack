
import { NextResponse } from "next/server";
import { EnrichmentService } from "@/modules/enrichment/service/EnrichmentService";
import { handleAPIError } from "@/lib/apiResponse";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const lead = await EnrichmentService.enrichLead(id);
        return NextResponse.json(lead);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
