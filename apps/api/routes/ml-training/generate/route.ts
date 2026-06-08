/**
 * API Route: Generate Synthetic Training Data
 * 
 * POST /api/ml-training/generate
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syntheticDataGenerator } from "@/modules/ml-training/generators/SyntheticGenerator";
import { z } from "zod";
import { UserRole } from "@prisma/client";
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
    const session = await getServerSession(authOptions);

    // Require admin or system_admin role
    const allowedRoles: string[] = [UserRole.SYSTEM_ADMIN, UserRole.ORG_ADMIN];
    if (!session || !allowedRoles.includes((session.user as any).enterpriseRole)) {
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
