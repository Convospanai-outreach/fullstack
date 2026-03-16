import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { trainingManager } from "@/modules/ml-training/training/TrainingManager";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const allowedRoles: string[] = [UserRole.SYSTEM_ADMIN, UserRole.ORG_ADMIN];
    if (!session || !allowedRoles.includes((session.user as any).enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const datasetId = body.datasetId || body.config?.datasetId;
    const datasetVersion = body.config?.datasetVersion || body.config?.datasetName;
    const baseModel = body.baseModel || body.config?.baseModel;

    let resolvedDatasetId = datasetId;
    if (!resolvedDatasetId && datasetVersion) {
        const { prisma } = await import("@/lib/db");
        const dataset = await prisma.trainingDataset.findFirst({
            where: { version: datasetVersion }
        });
        resolvedDatasetId = dataset?.id;
    }

    if (!resolvedDatasetId) {
        return NextResponse.json({ error: "datasetId required" }, { status: 400 });
    }

    const modelVersionId = await trainingManager.startTraining(resolvedDatasetId, baseModel);
    return NextResponse.json({ success: true, pipelineId: modelVersionId });
}
