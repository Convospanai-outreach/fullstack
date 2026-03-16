import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { caseStudyService } from "@/modules/scoring";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const data = body.data ?? body;
    const created = await caseStudyService.ingestCaseStudy(data, ctx.teamId);
    return NextResponse.json(created);
}

export async function DELETE(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const caseStudyId = body.caseStudyId;
    if (!caseStudyId) return NextResponse.json({ error: "caseStudyId required" }, { status: 400 });

    const ok = await caseStudyService.deleteCaseStudy(caseStudyId, ctx.teamId);
    return NextResponse.json({ success: ok });
}
