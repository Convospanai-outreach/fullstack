import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { caseStudyService } from "@/modules/scoring";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { query, limit } = body;
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    const results = await caseStudyService.retrieveRelevantCaseStudies(query, ctx.teamId, limit ?? 3);
    return NextResponse.json(results);
}
