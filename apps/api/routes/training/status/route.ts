import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipelineId");
    if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });

    const model = await prisma.modelVersion.findUnique({
        where: { id: pipelineId }
    });
    if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
        status: model.status,
        modelVersion: model.version,
        updatedAt: model.updatedAt
    });
}
