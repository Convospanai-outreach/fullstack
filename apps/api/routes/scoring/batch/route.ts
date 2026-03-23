import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { leadScoringService } from "@/modules/scoring";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await leadScoringService.batchScoreLeads(ctx.teamId);
    return NextResponse.json(result);
}
