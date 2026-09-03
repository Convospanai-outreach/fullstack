import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockEnforcePolicy, mockAudit, mockBatchScrape } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockEnforcePolicy: vi.fn(),
    mockAudit: vi.fn(),
    mockBatchScrape: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: mockEnforcePolicy }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("../service/scraperService", () => ({ scraperService: { batchScrape: mockBatchScrape } }));

import { POST } from "./batch-scrape";

function postRequest(body: unknown) {
    return new Request("http://localhost/scraper-bridge/batch-scrape", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /scraper-bridge/batch-scrape", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnforcePolicy.mockResolvedValue(undefined);
        mockBatchScrape.mockResolvedValue([{ ok: true }]);
    });

    it("rejects an unauthenticated caller before running any scrape", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ requests: [{ url: "https://example.com" }] }));

        expect(res.status).toBe(401);
        expect(mockBatchScrape).not.toHaveBeenCalled();
    });

    it("enforces the same governance policy as the single-request sibling", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockEnforcePolicy.mockRejectedValue(new Error("Quota exceeded"));

        const res = await POST(postRequest({ requests: [{ url: "https://example.com" }] }));

        expect(res.status).toBe(403);
        expect(mockBatchScrape).not.toHaveBeenCalled();
    });

    it("runs the batch scrape for an authenticated, policy-approved caller", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });

        const res = await POST(postRequest({ requests: [{ url: "https://example.com" }] }));

        expect(res.status).toBe(200);
        expect(mockEnforcePolicy).toHaveBeenCalledWith(
            expect.objectContaining({ orgId: "team-1", userId: "user-1", action: "SCRAPING" })
        );
        expect(mockBatchScrape).toHaveBeenCalledWith([{ url: "https://example.com" }]);
        expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "user-1", orgId: "team-1" }));
    });
});
