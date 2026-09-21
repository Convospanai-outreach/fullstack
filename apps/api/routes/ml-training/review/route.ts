/**
 * API Route: Human Review Submission
 * 
 * POST /api/ml-training/review
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { reviewService } from "@/modules/ml-training/review/ReviewService";
import { z } from "zod";

const reviewRecordSchema = z.object({
    recordId: z.string(),
    score: z.object({
        policy_correctness: z.number().min(1).max(5),
        tone_quality: z.number().min(1).max(5),
        clarity: z.number().min(1).max(5),
        realism: z.number().min(1).max(5),
        refusal_quality: z.number().min(1).max(5).optional()
    }),
    approved: z.boolean()
});

const reviewDatasetSchema = z.object({
    datasetId: z.string(),
    sampleSize: z.number(),
    scores: z.object({
        policy_correctness: z.number().min(1).max(5),
        tone_quality: z.number().min(1).max(5),
        clarity: z.number().min(1).max(5),
        realism: z.number().min(1).max(5),
        refusal_quality: z.number().min(1).max(5).optional()
    }),
    notes: z.string().optional(),
    approved: z.boolean()
});

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!teamId) {
        return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    try {
        const body = await req.json();

        // Determine if this is a record review or dataset review
        if (body.recordId) {
            const { recordId, score, approved } = reviewRecordSchema.parse(body);

            const result = await reviewService.reviewRecord(
                recordId,
                userId,
                score,
                approved,
                teamId
            );

            // null => the record isn't in the caller's team (S-04 class IDOR).
            if (!result) {
                return NextResponse.json({ error: "Record not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                ...result
            });

        } else if (body.datasetId) {
            const data = reviewDatasetSchema.parse(body);

            const result = await reviewService.submitDatasetReview({
                ...data,
                reviewerId: userId
            }, teamId);

            if (!result) {
                return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                ...result
            });
        } else {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("[ML-Training] Review submission failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!teamId) {
        return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const datasetId = searchParams.get("datasetId");
        const sample = searchParams.get("sample") === "true";

        if (!datasetId) {
            return NextResponse.json({ error: "datasetId required" }, { status: 400 });
        }

        if (sample) {
            const sampleSize = parseInt(searchParams.get("size") || "50");
            // Scoped by teamId: another team's dataset returns no records rather
            // than leaking its training data (S-04 class IDOR).
            const records = await reviewService.getSampleForReview(datasetId, teamId, sampleSize);

            return NextResponse.json({ records });
        } else {
            const stats = await reviewService.getDatasetStats(datasetId, teamId);
            // null => not the caller's dataset; 404 without leaking existence.
            if (!stats) {
                return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
            }
            const queue = await reviewService.getReviewQueue(datasetId, teamId);

            return NextResponse.json({ queue, stats });
        }

    } catch (error: any) {
        console.error("[ML-Training] Review fetch failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
