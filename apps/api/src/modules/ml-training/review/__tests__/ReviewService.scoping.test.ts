import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        trainingRecord: { updateMany: vi.fn(), findMany: vi.fn() },
        trainingDataset: { findFirst: vi.fn(), updateMany: vi.fn() },
        datasetReview: { create: vi.fn() },
        $queryRaw: vi.fn()
    }
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { reviewService } from "../ReviewService";

const goodScore = { policy_correctness: 5, tone_quality: 5, clarity: 5, realism: 5 };
const lowScore = { policy_correctness: 2, tone_quality: 2, clarity: 2, realism: 2 };

describe("ReviewService tenant scoping (S-04 class)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("reviewRecord", () => {
        it("scopes the update by teamId (fails closed for wrong-team / legacy null-team records) and returns null when nothing matched", async () => {
            mockPrisma.trainingRecord.updateMany.mockResolvedValue({ count: 0 });

            const result = await reviewService.reviewRecord("rec-1", "user-1", goodScore, true, "team-a");

            expect(result).toBeNull();
            // The teamId MUST be in the where filter literally - a `teamId ?? undefined`
            // slip would drop it and reopen the IDOR across every record.
            expect(mockPrisma.trainingRecord.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "rec-1", teamId: "team-a" } })
            );
        });

        it("updates and returns the score when the record is in the caller's team", async () => {
            mockPrisma.trainingRecord.updateMany.mockResolvedValue({ count: 1 });

            const result = await reviewService.reviewRecord("rec-1", "user-1", goodScore, true, "team-a");

            expect(result).toEqual({ avgScore: 5, approved: true });
        });

        it("auto-rejects a below-threshold score", async () => {
            mockPrisma.trainingRecord.updateMany.mockResolvedValue({ count: 1 });

            const result = await reviewService.reviewRecord("rec-1", "user-1", lowScore, true, "team-a");

            expect(result).toEqual({ avgScore: 2, approved: false });
        });
    });

    describe("submitDatasetReview", () => {
        const review = { datasetId: "ds-1", reviewerId: "user-1", sampleSize: 10, scores: goodScore, approved: true };

        it("returns null and writes nothing when the dataset is not in the caller's team", async () => {
            mockPrisma.trainingDataset.findFirst.mockResolvedValue(null);

            const result = await reviewService.submitDatasetReview(review, "team-a");

            expect(result).toBeNull();
            expect(mockPrisma.trainingDataset.findFirst).toHaveBeenCalledWith({
                where: { id: "ds-1", teamId: "team-a" },
                select: { id: true }
            });
            expect(mockPrisma.datasetReview.create).not.toHaveBeenCalled();
            expect(mockPrisma.trainingDataset.updateMany).not.toHaveBeenCalled();
        });

        it("records the review and scopes the status update by teamId when owned", async () => {
            mockPrisma.trainingDataset.findFirst.mockResolvedValue({ id: "ds-1" });
            mockPrisma.datasetReview.create.mockResolvedValue({ id: "rev-1" });
            mockPrisma.trainingDataset.updateMany.mockResolvedValue({ count: 1 });

            const result = await reviewService.submitDatasetReview(review, "team-a");

            expect(result).toEqual({ avgScore: 5, approved: true });
            expect(mockPrisma.trainingDataset.updateMany).toHaveBeenCalledWith({
                where: { id: "ds-1", teamId: "team-a" },
                data: { status: "REVIEWED" }
            });
        });
    });

    describe("getDatasetStats / getReviewQueue / getSampleForReview", () => {
        it("returns null stats for a dataset not in the caller's team", async () => {
            mockPrisma.trainingDataset.findFirst.mockResolvedValue(null);
            const stats = await reviewService.getDatasetStats("ds-1", "team-a");
            expect(stats).toBeNull();
            expect(mockPrisma.trainingDataset.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "ds-1", teamId: "team-a" } })
            );
        });

        it("scopes the review queue by teamId", async () => {
            mockPrisma.trainingRecord.findMany.mockResolvedValue([]);
            await reviewService.getReviewQueue("ds-1", "team-a");
            expect(mockPrisma.trainingRecord.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { datasetId: "ds-1", teamId: "team-a", reviewedBy: null } })
            );
        });

        it("passes the datasetId and teamId to the sampling query", async () => {
            mockPrisma.$queryRaw.mockResolvedValue([]);
            await reviewService.getSampleForReview("ds-1", "team-a", 10);
            // Tagged-template call: the interpolated values land in the params array.
            const params = mockPrisma.$queryRaw.mock.calls[0].slice(1);
            expect(params).toContain("ds-1");
            expect(params).toContain("team-a");
        });
    });
});
