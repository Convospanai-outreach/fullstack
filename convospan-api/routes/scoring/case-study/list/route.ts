import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { caseStudyService } from "@/modules/scoring";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await caseStudyService.listCaseStudies(ctx.teamId);
    return NextResponse.json(items);
}
