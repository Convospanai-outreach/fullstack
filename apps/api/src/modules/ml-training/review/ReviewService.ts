/**
 * Human Review Service - Enterprise ML Training
 * 
 * Implements 5-point scoring rubric and approval workflow.
 * Ensures dataset quality before training.
 */

import { prisma } from "@/lib/db";
import type { ReviewScore, DatasetReviewSubmission } from "../types";

export class ReviewService {

    /**
     * Fetch records pending review
     */
    async getReviewQueue(datasetId: string, teamId: string, limit: number = 50) {
        const records = await prisma.trainingRecord.findMany({
            where: {
                datasetId,
                teamId,
                reviewedBy: null
            },
            take: limit,
            orderBy: { createdAt: 'asc' }
        });

        return records;
    }

    /**
     * Submit review score for a single record. Scoped to teamId so a user cannot
     * score/approve another team's training record (which would poison its
     * training data). Returns null when the record does not belong to the team -
     * including legacy null-team rows, which the compound `where` fails closed on.
     * updateMany (not update) both scopes the non-unique compound condition and
     * avoids a findFirst-then-update TOCTOU window.
     */
    async reviewRecord(
        recordId: string,
        reviewerId: string,
        score: ReviewScore,
        approved: boolean,
        teamId: string
    ): Promise<{ avgScore: number; approved: boolean } | null> {

        // Validate score range
        const avgScore = this.calculateAverageScore(score);

        if (avgScore < 4.0) {
            approved = false; // Auto-reject if score below threshold
        }

        const updated = await prisma.trainingRecord.updateMany({
            where: { id: recordId, teamId },
            data: {
                reviewScore: avgScore,
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
                approved
            }
        });

        if (updated.count === 0) return null;

        return { avgScore, approved };
    }

    /**
     * Calculate average score from rubric
     */
    private calculateAverageScore(score: ReviewScore): number {
        const scores = [
            score.policy_correctness,
            score.tone_quality,
            score.clarity,
            score.realism
        ];

        if (score.refusal_quality !== undefined) {
            scores.push(score.refusal_quality);
        }

        const sum = scores.reduce((a, b) => a + b, 0);
        return sum / scores.length;
    }

    /**
     * Submit dataset-level review (after sampling)
     */
    async submitDatasetReview(review: DatasetReviewSubmission, teamId: string): Promise<{ avgScore: number; approved: boolean } | null> {

        // Only the owning team may review its own dataset (fails closed for
        // legacy null-team datasets). Returns null so the route can 404 without
        // leaking existence.
        const owned = await prisma.trainingDataset.findFirst({
            where: { id: review.datasetId, teamId },
            select: { id: true }
        });
        if (!owned) return null;

        const avgScore = this.calculateAverageScore(review.scores);

        await prisma.datasetReview.create({
            data: {
                datasetId: review.datasetId,
                reviewerId: review.reviewerId,
                sampleSize: review.sampleSize,
                avgScore,
                policyCorrectness: review.scores.policy_correctness,
                toneQuality: review.scores.tone_quality,
                clarity: review.scores.clarity,
                realism: review.scores.realism,
                refusalQuality: review.scores.refusal_quality ?? null,
                notes: review.notes ?? null,
                approved: review.approved
            }
        });

        // Update dataset status (scoped by teamId here too, not just the precheck).
        if (review.approved) {
            await prisma.trainingDataset.updateMany({
                where: { id: review.datasetId, teamId },
                data: { status: 'REVIEWED' }
            });
        }

        return { avgScore, approved: review.approved };
    }

    /**
     * Get dataset review statistics
     */
    async getDatasetStats(datasetId: string, teamId: string) {
        const dataset = await prisma.trainingDataset.findFirst({
            where: { id: datasetId, teamId },
            include: {
                records: {
                    select: {
                        approved: true,
                        reviewScore: true,
                        reviewedBy: true
                    }
                },
                reviews: true
            }
        });

        if (!dataset) {
            return null; // not found, or not owned by this team
        }

        const totalRecords = dataset.records.length;
        const reviewedRecords = dataset.records.filter(r => r.reviewedBy !== null).length;
        const approvedRecords = dataset.records.filter(r => r.approved).length;
        const avgScore = dataset.records
            .filter(r => r.reviewScore !== null)
            .reduce((sum, r) => sum + (r.reviewScore || 0), 0) / reviewedRecords || 0;

        return {
            totalRecords,
            reviewedRecords,
            approvedRecords,
            rejectedRecords: reviewedRecords - approvedRecords,
            reviewProgress: (reviewedRecords / totalRecords) * 100,
            avgScore,
            needsReview: totalRecords - reviewedRecords,
            datasetReviews: dataset.reviews
        };
    }

    /**
     * Get random sample of records for quick review
     */
    async getSampleForReview(datasetId: string, teamId: string, sampleSize: number = 50) {


        const records = await prisma.$queryRaw<any[]>`
      SELECT * FROM "TrainingRecord"
      WHERE "datasetId" = ${datasetId} AND "teamId" = ${teamId}
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    `;

        return records;
    }
}

export const reviewService = new ReviewService();
