import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { leadScoringService } from "@/modules/scoring";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const input = body.input ?? body;
    const result = await leadScoringService.calculateIntentScore(input);
    return NextResponse.json(result);
}
