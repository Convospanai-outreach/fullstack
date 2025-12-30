import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { knowledgeService } from "@/modules/knowledge/knowledgeService";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const kbs = await knowledgeService.listKnowledgeBases(ctx.teamId);
    return NextResponse.json({ success: true, data: kbs });
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { name, description } = await req.json();
        const kb = await knowledgeService.createKnowledgeBase(ctx.teamId, name, description);
        return NextResponse.json({ success: true, data: kb });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
