import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { caseStudyService } from "@/modules/scoring";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leadContext, purpose } = body;
    if (!leadContext || !purpose) {
        return NextResponse.json({ error: "leadContext and purpose required" }, { status: 400 });
    }

    const result = await caseStudyService.generateRAGEnhancedCopy(leadContext, purpose, ctx.teamId);
    return NextResponse.json(result);
}
