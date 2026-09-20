import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!teamId) return NextResponse.json({ error: "No active team" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipelineId");
    if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });

    const model = await prisma.modelVersion.findUnique({
        where: { id: pipelineId },
        include: { dataset: { select: { teamId: true } } }
    });
    // Scope by the owning dataset's team so a caller can't read another
    // tenant's training status by guessing a pipelineId (roadmap.md item 2.7).
    if (!model || model.dataset?.teamId !== teamId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
        status: model.status,
        modelVersion: model.version,
        updatedAt: model.updatedAt
    });
}
