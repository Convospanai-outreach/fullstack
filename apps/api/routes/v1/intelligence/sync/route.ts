import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { BullsEyeRAG } from "@/modules/rag/service/BullsEyeRAG";

/**
 * POST /api/v1/intelligence/sync
 * Manually trigger market intelligence sync from Netjana for a query.
 */
export async function POST(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "leads:write");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    try {
        const { query } = await req.json();
        if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

        // Trigger the sync autonomously
        await BullsEyeRAG.syncMarketIntelligence(query, auth.teamId);

        return NextResponse.json({ success: true, message: "Market intelligence sync initiated" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
