import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockReviewService } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockReviewService: {
        reviewRecord: vi.fn(),
        submitDatasetReview: vi.fn(),
        getReviewQueue: vi.fn(),
        getDatasetStats: vi.fn(),
        getSampleForReview: vi.fn()
    }
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/modules/ml-training/review/ReviewService", () => ({ reviewService: mockReviewService }));

import { POST, GET } from "./route";

const score = { policy_correctness: 5, tone_quality: 5, clarity: 5, realism: 5 };

function postRequest(body: any) {
    return new Request("http://localhost/api/ml-training/review", { method: "POST", body: JSON.stringify(body) }) as any;
}
function getRequest(qs: string) {
    return new Request(`http://localhost/api/ml-training/review?${qs}`, { method: "GET" }) as any;
}

describe("ml-training/review route tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("POST 401s an unauthenticated caller", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });
        const res = await POST(postRequest({ recordId: "rec-1", score, approved: true }));
        expect(res.status).toBe(401);
        expect(mockReviewService.reviewRecord).not.toHaveBeenCalled();
    });

    it("POST 403s an authenticated caller with no active team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: null });
        const res = await POST(postRequest({ recordId: "rec-1", score, approved: true }));
        expect(res.status).toBe(403);
        expect(mockReviewService.reviewRecord).not.toHaveBeenCalled();
    });

    it("POST passes the caller's teamId to reviewRecord and 404s when the record isn't in the team", async () => {
        mockReviewService.reviewRecord.mockResolvedValue(null);
        const res = await POST(postRequest({ recordId: "rec-1", score, approved: true }));
        expect(res.status).toBe(404);
        expect(mockReviewService.reviewRecord).toHaveBeenCalledWith("rec-1", "user-1", score, true, "team-a");
    });

    it("POST returns success when the record review succeeds", async () => {
        mockReviewService.reviewRecord.mockResolvedValue({ avgScore: 5, approved: true });
        const res = await POST(postRequest({ recordId: "rec-1", score, approved: true }));
        expect(res.status).toBe(200);
        expect((await res.json()).success).toBe(true);
    });

    it("POST dataset review 404s when the dataset isn't in the team", async () => {
        mockReviewService.submitDatasetReview.mockResolvedValue(null);
        const res = await POST(postRequest({ datasetId: "ds-1", sampleSize: 10, scores: score, approved: true }));
        expect(res.status).toBe(404);
        expect(mockReviewService.submitDatasetReview).toHaveBeenCalledWith(
            expect.objectContaining({ datasetId: "ds-1", reviewerId: "user-1" }),
            "team-a"
        );
    });

    it("GET 403s with no active team", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: null });
        const res = await GET(getRequest("datasetId=ds-1"));
        expect(res.status).toBe(403);
    });

    it("GET 404s when the dataset stats aren't in the team", async () => {
        mockReviewService.getDatasetStats.mockResolvedValue(null);
        const res = await GET(getRequest("datasetId=ds-1"));
        expect(res.status).toBe(404);
        expect(mockReviewService.getDatasetStats).toHaveBeenCalledWith("ds-1", "team-a");
        expect(mockReviewService.getReviewQueue).not.toHaveBeenCalled();
    });

    it("GET scopes the sample query by teamId", async () => {
        mockReviewService.getSampleForReview.mockResolvedValue([]);
        const res = await GET(getRequest("datasetId=ds-1&sample=true&size=25"));
        expect(res.status).toBe(200);
        expect(mockReviewService.getSampleForReview).toHaveBeenCalledWith("ds-1", "team-a", 25);
    });
});
