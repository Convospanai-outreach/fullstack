import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiAuth";
import { KnowledgeIngressService } from "@/modules/rag/service/KnowledgeIngressService";

/**
 * POST /api/v1/knowledge/ingress
 * Ingests external knowledge for a specific campaign.
 */
export async function POST(req: NextRequest) {
    const auth = await validateApiKey(req, "leads:write"); // Reusing high-level write scope
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { campaignId, source, type, content } = body;

        if (!campaignId || !source || !type) {
            return NextResponse.json({ error: "campaignId, source, and type are required" }, { status: 400 });
        }

        await KnowledgeIngressService.ingressCampaignKnowledge(campaignId, content || source, type);

        return NextResponse.json({ success: true, message: "Knowledge ingestion queued" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/v1/knowledge/search
 * Searches campaign-specific knowledge (Agentic RAG).
 */
export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req, "leads:read");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const query = searchParams.get("q");

    if (!campaignId || !query) {
        return NextResponse.json({ error: "campaignId and q (query) are required" }, { status: 400 });
    }

    try {
        const results = await KnowledgeIngressService.agenticSearch(campaignId, query);
        return NextResponse.json({ results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
