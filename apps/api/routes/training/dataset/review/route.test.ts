import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAdminUser, mockDatasetService } = vi.hoisted(() => ({
    mockGetAdminUser: vi.fn(),
    mockDatasetService: { reviewDataset: vi.fn() },
}));

vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/modules/training/DatasetService", () => ({ datasetService: mockDatasetService }));

import { POST } from "./route";

function postRequest(body: any) {
    return new Request("http://localhost/api/training/dataset/review", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /training/dataset/review", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("401s a non-admin caller", async () => {
        mockGetAdminUser.mockResolvedValue(null);

        const res = await POST(postRequest({ datasetId: "ds-1", sampleSize: 20, scores: {} }));

        expect(res.status).toBe(401);
        expect(mockDatasetService.reviewDataset).not.toHaveBeenCalled();
    });

    it("delegates review to DatasetService.reviewDataset, which now transitions the dataset to REVIEWED", async () => {
        mockGetAdminUser.mockResolvedValue({ id: "admin-1" });
        const scores = { policy: 1, tone: 1, clarity: 1, realism: 1 };
        mockDatasetService.reviewDataset.mockResolvedValue({ id: "review-1", approved: true });

        const res = await POST(postRequest({ datasetId: "ds-1", sampleSize: 20, scores }));

        expect(res.status).toBe(200);
        expect(mockDatasetService.reviewDataset).toHaveBeenCalledWith("ds-1", "admin-1", 20, scores);
    });
});
