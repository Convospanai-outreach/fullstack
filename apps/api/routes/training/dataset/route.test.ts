import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockDatasetService } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockDatasetService: { createDataset: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/modules/training/DatasetService", () => ({ datasetService: mockDatasetService }));

import { POST } from "./route";

function postRequest(body: any) {
    return new Request("http://localhost/api/training/dataset", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /training/dataset", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("401s an unauthenticated caller", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null });

        const res = await POST(postRequest({ name: "v1" }));

        expect(res.status).toBe(401);
        expect(mockDatasetService.createDataset).not.toHaveBeenCalled();
    });

    it("delegates dataset creation to DatasetService instead of duplicating the write", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1" });
        mockDatasetService.createDataset.mockResolvedValue({ id: "ds-1", version: "v1" });

        const res = await POST(postRequest({ name: "v1", teamId: "team-1", taskType: "REFUSAL_GENERATION" }));

        expect(res.status).toBe(200);
        expect(mockDatasetService.createDataset).toHaveBeenCalledWith("team-1", "v1", "REFUSAL_GENERATION");
    });
});
