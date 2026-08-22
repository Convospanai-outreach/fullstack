/**
 * API Route: Generate Synthetic Training Data
 * 
 * POST /api/ml-training/generate
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { syntheticDataGenerator } from "@/modules/ml-training/generators/SyntheticGenerator";
import { z } from "zod";
import { logger } from "@/lib/logger";

const generateSchema = z.object({
    taskType: z.enum([
        'TONE_NORMALIZATION',
        'GRAMMAR_REPAIR',
        'BRAND_ENFORCEMENT',
        'POLICY_CLASSIFICATION',
        'POLICY_REWRITE',
        'CONVERSATION_SUMMARY',
        'OBJECTION_EXTRACTION',
        'REFUSAL_GENERATION'
    ]),
    version: z.string(),
    teamId: z.string()
});

export async function POST(req: NextRequest) {
    // Require admin or system_admin role
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { taskType, version, teamId } = generateSchema.parse(body);

        logger.info("[ML-Training] Starting generation", { taskType, version });

        // Generate dataset
        const datasetId = await syntheticDataGenerator.generateAndSaveDataset(
            taskType,
            version,
            teamId
        );

        return NextResponse.json({
            success: true,
            datasetId,
            message: `Dataset ${version} generated successfully`
        });

    } catch (error: any) {
        console.error("[ML-Training] Generation failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
