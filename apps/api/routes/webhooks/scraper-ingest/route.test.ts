import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const SCRAPER_SECRET = "test-scraper-secret";

const { mockScrapingJob, mockGetClient, mockEvaluate, mockMask, mockGetRegionFromContext, mockProcessWebhookData, mockRecordPulse } =
    vi.hoisted(() => ({
        mockScrapingJob: { findUnique: vi.fn(), upsert: vi.fn() },
        mockGetClient: vi.fn(),
        mockEvaluate: vi.fn(),
        mockMask: vi.fn(),
        mockGetRegionFromContext: vi.fn(),
        mockProcessWebhookData: vi.fn(),
        mockRecordPulse: vi.fn(),
    }));

vi.mock("@/lib/dbFactory", () => ({
    DbFactory: { getClient: mockGetClient },
}));
vi.mock("@/modules/audit/SentinelService", () => ({
    SentinelService: { evaluate: mockEvaluate },
}));
vi.mock("@/lib/ai/SovereignFirewall", () => ({
    SovereignFirewall: { mask: mockMask },
}));
vi.mock("@/modules/compliance/ResidencyLockService", () => ({
    ResidencyLockService: { getRegionFromContext: mockGetRegionFromContext },
}));
vi.mock("@/services/IntentScoring", () => ({
    intentScoringService: { processWebhookData: mockProcessWebhookData },
}));
vi.mock("@/modules/audit/ServiceWatcher", () => ({
    serviceWatcher: { recordPulse: mockRecordPulse },
}));

import { POST } from "./route";

function signedRequest(body: any, { badHash = false }: { badHash?: boolean } = {}) {
    const rawBody = JSON.stringify(body);
    const timestamp = String(Date.now());
    const expectedHash = crypto.createHmac("sha256", SCRAPER_SECRET).update(`${rawBody}.${timestamp}`).digest("hex");
    const complianceHash = badHash ? "0".repeat(64) : expectedHash;

    return new Request("http://localhost/webhooks/scraper-ingest", {
        method: "POST",
        headers: {
            "X-Scraper-Secret": SCRAPER_SECRET,
            "X-Timestamp": timestamp,
            "X-Compliance-Hash": complianceHash,
            "content-type": "application/json",
        },
        body: rawBody,
    });
}

describe("POST /webhooks/scraper-ingest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["SCRAPER_SECRET"] = SCRAPER_SECRET;
        mockGetClient.mockReturnValue({ scrapingJob: mockScrapingJob });
        mockGetRegionFromContext.mockReturnValue("GLOBAL");
        mockEvaluate.mockResolvedValue({ status: "PASS", action_taken: "NONE" });
        mockMask.mockResolvedValue({ safeContext: JSON.stringify({ ok: true }), tokenMap: new Map() });
        mockScrapingJob.findUnique.mockResolvedValue(null);
        mockScrapingJob.upsert.mockResolvedValue({ id: "job-1" });
        mockProcessWebhookData.mockResolvedValue(undefined);
    });

    it("rejects a request with an invalid compliance hash", async () => {
        const res = await POST(signedRequest({ jobId: "job-1", url: "https://example.com" }, { badHash: true }));
        expect(res.status).toBe(401);
        expect(mockScrapingJob.upsert).not.toHaveBeenCalled();
    });

    it("sets teamId on create when the caller supplies one", async () => {
        const res = await POST(signedRequest({ jobId: "job-1", url: "https://example.com", teamId: "team-1" }));
        expect(res.status).toBe(200);
        expect(mockScrapingJob.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ teamId: "team-1" }),
            })
        );
    });

    it("rejects a jobId collision with a different team's existing job", async () => {
        mockScrapingJob.findUnique.mockResolvedValue({ teamId: "team-a" });

        const res = await POST(signedRequest({ jobId: "job-1", url: "https://example.com", teamId: "team-b" }));

        expect(res.status).toBe(409);
        expect(mockScrapingJob.upsert).not.toHaveBeenCalled();
    });

    it("allows re-posting to the same team's existing job", async () => {
        mockScrapingJob.findUnique.mockResolvedValue({ teamId: "team-a" });

        const res = await POST(signedRequest({ jobId: "job-1", url: "https://example.com", teamId: "team-a" }));

        expect(res.status).toBe(200);
        expect(mockScrapingJob.upsert).toHaveBeenCalled();
    });
});
