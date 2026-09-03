import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { knowledgeService } from "@/modules/knowledge/knowledgeService";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params; // knowledgeBaseId
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Without this, any authenticated user could inject a document into another
    // team's knowledge base by supplying its id.
    const kb = await prisma.knowledgeBase.findFirst({ where: { id, teamId: ctx.teamId } });
    if (!kb) return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });

    try {
        const { content, metadata } = await req.json();
        if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });

        const item = await knowledgeService.addDocument(id, content, metadata);
        return NextResponse.json({ success: true, data: item });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Without this, any authenticated user could search - or with no auth check at
    // all, previously, anyone - another team's knowledge base contents by id.
    const kb = await prisma.knowledgeBase.findFirst({ where: { id, teamId: ctx.teamId } });
    if (!kb) return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

    try {
        const results = await knowledgeService.search(id, query);
        return NextResponse.json({ success: true, data: results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
