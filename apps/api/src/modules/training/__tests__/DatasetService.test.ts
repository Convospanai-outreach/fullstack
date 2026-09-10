import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
    trainingDataset: { create: vi.fn(), update: vi.fn() },
    trainingRecord: { create: vi.fn() },
    datasetReview: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { DatasetService } from "../DatasetService";

describe("DatasetService.reviewDataset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("transitions the dataset to REVIEWED so TrainingManager.startTraining's status gate can pass", async () => {
        mockPrisma.datasetReview.create.mockResolvedValue({ id: "review-1" });
        mockPrisma.trainingDataset.update.mockResolvedValue({ id: "ds-1", status: "REVIEWED" });

        await DatasetService.reviewDataset("ds-1", "reviewer-1", 20, {
            policy: 0.9,
            tone: 0.9,
            clarity: 0.9,
            realism: 0.9,
        });

        expect(mockPrisma.trainingDataset.update).toHaveBeenCalledWith({
            where: { id: "ds-1" },
            data: { status: "REVIEWED" },
        });
    });
});
