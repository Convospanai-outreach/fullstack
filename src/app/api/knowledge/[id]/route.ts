import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { ingestService } from "@/modules/rag/service/ingest";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { type, url, fileName, content } = await req.json();

        // Verify KB belongs to team
        const kb = await prisma.knowledgeBase.findFirst({
            where: { id: params.id, teamId }
        });
        if (!kb) return new NextResponse("Knowledge Base not found", { status: 404 });

        if (type === "URL") {
            if (!url) return new NextResponse("URL is required", { status: 400 });
            await ingestService.ingestUrl(url, params.id);
        } else if (type === "FILE") {
            if (!fileName || !content) return new NextResponse("Missing file details", { status: 400 });
            await ingestService.ingestDocument(fileName, content, params.id);
        } else {
            return new NextResponse("Invalid ingestion type", { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Ingestion Error:", error);
        return new NextResponse(error.message, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    const items = await prisma.knowledgeItem.findMany({
        where: { knowledgeBaseId: params.id },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(items);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    // Verify KB belongs to team before delete
    const kb = await prisma.knowledgeBase.findFirst({
        where: { id: params.id, teamId }
    });
    if (!kb) return new NextResponse("Unauthorized", { status: 403 });

    await prisma.knowledgeBase.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
}
