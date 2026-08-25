import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        trainingDataset: {
            findUnique: vi.fn(),
        },
        modelVersion: {
            create: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { trainingManager } from "../TrainingManager";

describe("TrainingManager.startTraining", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws Dataset not found when the dataset doesn't exist", async () => {
        (prisma.trainingDataset.findUnique as any).mockResolvedValueOnce(null);

        await expect(trainingManager.startTraining("missing")).rejects.toThrow("Dataset not found");
    });

    it("throws when the dataset isn't REVIEWED", async () => {
        (prisma.trainingDataset.findUnique as any).mockResolvedValueOnce({
            version: "v1",
            status: "DRAFT",
            records: [],
        });

        await expect(trainingManager.startTraining("d1")).rejects.toThrow("REVIEWED");
    });

    it("throws when the dataset has fewer than 10 records", async () => {
        (prisma.trainingDataset.findUnique as any).mockResolvedValueOnce({
            version: "v1",
            status: "REVIEWED",
            records: new Array(5).fill({}),
        });

        await expect(trainingManager.startTraining("d1")).rejects.toThrow("too small");
    });

    // OPEN-79 regression: a valid dataset used to trigger a fabricated,
    // randomized "training run" (fake progress, fake evaluation, a fake
    // DEPLOYED model). It must now fail honestly instead, with no
    // ModelVersion row created.
    it("fails honestly instead of simulating a fake training run for a valid dataset", async () => {
        (prisma.trainingDataset.findUnique as any).mockResolvedValueOnce({
            version: "v1",
            status: "REVIEWED",
            records: new Array(20).fill({}),
        });

        await expect(trainingManager.startTraining("d1", "gemini-1.5-flash")).rejects.toThrow(
            "not implemented"
        );
        expect(prisma.modelVersion.create).not.toHaveBeenCalled();
    });
});
