/**
 * API Route: Model Evaluation Metrics
 * 
 * GET /api/ml-training/metrics/:version
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { evaluationService } from "@/modules/ml-training/evaluation/EvaluationService";
import { prisma } from "@/lib/db";

export async function GET(
    _req: NextRequest,
    { params }: { params: { version: string } }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { version } = params;

        // Find model version
        const modelVersion = await prisma.modelVersion.findUnique({
            where: { version },
            include: { metrics: true }
        });

        if (!modelVersion) {
            return NextResponse.json({ error: "Model version not found" }, { status: 404 });
        }

        // Get aggregated metrics
        const metrics = await evaluationService.getModelMetrics(modelVersion.id);
        const isReady = await evaluationService.validateModelReadiness(modelVersion.id);

        return NextResponse.json({
            version: modelVersion.version,
            status: modelVersion.status,
            metrics,
            isReady,
            deployedAt: modelVersion.deployedAt,
            rawMetrics: modelVersion.metrics
        });

    } catch (error: any) {
        console.error("[ML-Training] Metrics fetch failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
