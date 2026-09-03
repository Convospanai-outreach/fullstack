import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { ingestService } from "@/modules/rag/service/ingest";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { type, url, fileName, content } = await req.json();

        // Verify KB belongs to team
        const kb = await prisma.knowledgeBase.findFirst({
            where: { id, teamId }
        });
        if (!kb) return new NextResponse("Knowledge Base not found", { status: 404 });

        if (type === "URL") {
            if (!url) return new NextResponse("URL is required", { status: 400 });
            await ingestService.ingestUrl(url, id);
        } else if (type === "FILE") {
            if (!fileName || !content) return new NextResponse("Missing file details", { status: 400 });
            await ingestService.ingestDocument(fileName, content, id);
        } else {
            return new NextResponse("Invalid ingestion type", { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Ingestion Error:", error);
        return new NextResponse(error.message, { status: 500 });
    }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    // Verify KB belongs to team - without this, any authenticated user could list
    // another team's knowledge base contents by id, same as this file's own POST/DELETE.
    const kb = await prisma.knowledgeBase.findFirst({ where: { id, teamId } });
    if (!kb) return new NextResponse("Knowledge Base not found", { status: 404 });

    const items = await prisma.knowledgeItem.findMany({
        where: { knowledgeBaseId: id },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(items);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    // Scoped by teamId in the actual delete too, not just this pre-check - same
    // "scope the mutation" fix already applied elsewhere this session (OPEN-99/109/
    // 110/118/120/121). KnowledgeBase has no compound unique on (id, teamId), so
    // deleteMany() is used instead of delete().
    const deleted = await prisma.knowledgeBase.deleteMany({ where: { id, teamId } });
    if (deleted.count === 0) return new NextResponse("Unauthorized", { status: 403 });

    return NextResponse.json({ success: true });
}
