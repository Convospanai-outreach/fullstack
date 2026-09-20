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
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ name: "v1" }));

        expect(res.status).toBe(401);
        expect(mockDatasetService.createDataset).not.toHaveBeenCalled();
    });

    it("403s a caller with no active team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: null });

        const res = await POST(postRequest({ name: "v1" }));

        expect(res.status).toBe(403);
        expect(mockDatasetService.createDataset).not.toHaveBeenCalled();
    });

    it("creates the dataset for the caller's own team, ignoring any body.teamId", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-ctx" });
        mockDatasetService.createDataset.mockResolvedValue({ id: "ds-1", version: "v1" });

        // body.teamId is a spoof attempt - the route must use the context team.
        const res = await POST(postRequest({ name: "v1", teamId: "team-attacker", taskType: "REFUSAL_GENERATION" }));

        expect(res.status).toBe(200);
        expect(mockDatasetService.createDataset).toHaveBeenCalledWith("team-ctx", "v1", "REFUSAL_GENERATION");
    });
});
