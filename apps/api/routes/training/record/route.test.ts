import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockDatasetService } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockDatasetService: { addRecord: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/modules/training/DatasetService", () => ({ datasetService: mockDatasetService }));

import { POST } from "./route";

function postRequest(body: any) {
    return new Request("http://localhost/api/training/record", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /training/record", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("403s a caller with no active team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "u1", teamId: null });

        const res = await POST(postRequest({ datasetId: "ds-1", record: {} }));

        expect(res.status).toBe(403);
        expect(mockDatasetService.addRecord).not.toHaveBeenCalled();
    });

    it("passes the caller's context team to addRecord and 404s a cross-team dataset", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockDatasetService.addRecord.mockResolvedValue({ success: false, error: "Dataset not found" });

        const res = await POST(postRequest({ datasetId: "ds-other", record: { input_text: "x" } }));

        expect(res.status).toBe(404);
        expect(mockDatasetService.addRecord).toHaveBeenCalledWith("ds-other", { input_text: "x" }, "team-1");
    });

    it("returns the created record on success", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockDatasetService.addRecord.mockResolvedValue({ success: true, record: { id: "rec-1" } });

        const res = await POST(postRequest({ datasetId: "ds-1", record: { input_text: "x" } }));

        expect(res.status).toBe(200);
    });
});
