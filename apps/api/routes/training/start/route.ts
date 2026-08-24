import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { trainingManager } from "@/modules/ml-training/training/TrainingManager";

export async function POST(req: NextRequest) {
    const admin = await getAdminUser();
    if (!admin) {
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

    try {
        const modelVersionId = await trainingManager.startTraining(resolvedDatasetId, baseModel);
        return NextResponse.json({ success: true, pipelineId: modelVersionId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 501 });
    }
}
