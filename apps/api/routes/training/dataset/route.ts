import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = body.name || body.version;
    const taskType = body.taskType || "TONE_NORMALIZATION";
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const dataset = await prisma.trainingDataset.create({
        data: {
            version: name,
            taskType,
            recordCount: 0,
            datasetHash: `${name}-${Date.now()}`,
            configHash: `config-${Date.now()}`,
            status: "DRAFT"
        }
    });

    return NextResponse.json(dataset);
}
