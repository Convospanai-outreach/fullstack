import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        trainingDataset: {
            create: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        trainingRecord: {
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { DatasetService, type TrainingRecordData } from "@/modules/training/DatasetService";

const sampleRecord: TrainingRecordData = {
    task_type: "TONE_NORMALIZATION",
    input_text: "in",
    brand_rules: {},
    policy_rules: {},
    expected_output: "out",
    rejection_conditions: [],
};

describe("DatasetService tenant scoping (S-04)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("persists the caller's teamId when creating a dataset", async () => {
        mockPrisma.trainingDataset.create.mockResolvedValue({ id: "ds-1" });

        await DatasetService.createDataset("team-1", "v1", "TONE_NORMALIZATION");

        expect(mockPrisma.trainingDataset.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ teamId: "team-1", version: "v1" }) }),
        );
    });

    it("filters the dataset list by teamId", async () => {
        mockPrisma.trainingDataset.findMany.mockResolvedValue([]);

        await DatasetService.listDatasets("team-1");

        expect(mockPrisma.trainingDataset.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1" } }),
        );
    });

    it("refuses to append a record to a dataset owned by another team", async () => {
        mockPrisma.trainingDataset.findFirst.mockResolvedValue(null); // not found for this team

        const result = await DatasetService.addRecord("ds-other", sampleRecord, "team-1");

        expect(result.success).toBe(false);
        expect(mockPrisma.trainingDataset.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "ds-other", teamId: "team-1" } }),
        );
        expect(mockPrisma.trainingRecord.create).not.toHaveBeenCalled();
    });

    it("appends a record (stamped with teamId) when the dataset belongs to the caller's team", async () => {
        mockPrisma.trainingDataset.findFirst.mockResolvedValue({ id: "ds-1" });
        mockPrisma.trainingRecord.create.mockResolvedValue({ id: "rec-1" });

        const result = await DatasetService.addRecord("ds-1", sampleRecord, "team-1");

        expect(result.success).toBe(true);
        expect(mockPrisma.trainingRecord.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ datasetId: "ds-1", teamId: "team-1" }) }),
        );
    });
});
