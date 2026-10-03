import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const SCRAPER_SECRET = "test-scraper-secret";

const { mockScrapingJob, mockGetClient, mockEvaluate, mockMask, mockGetRegionFromContext, mockProcessWebhookData, mockRecordPulse, mockGetRedisClient } =
    vi.hoisted(() => ({
        mockScrapingJob: { findUnique: vi.fn(), upsert: vi.fn() },
        mockGetClient: vi.fn(),
        mockEvaluate: vi.fn(),
        mockMask: vi.fn(),
        mockGetRegionFromContext: vi.fn(),
        mockProcessWebhookData: vi.fn(),
        mockRecordPulse: vi.fn(),
        mockGetRedisClient: vi.fn(),
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
vi.mock("@/lib/redis", () => ({ getRedisClient: mockGetRedisClient }));

import { POST } from "./route";

function signedRequest(
    body: any,
    { badHash = false, timestamp = String(Date.now()), encodeHash = (h: string) => h }: {
        badHash?: boolean;
        timestamp?: string;
        encodeHash?: (hash: string) => string;
    } = {}
) {
    const rawBody = JSON.stringify(body);
    const expectedHash = crypto.createHmac("sha256", SCRAPER_SECRET).update(`${rawBody}.${timestamp}`).digest("hex");
    const complianceHash = badHash ? "0".repeat(64) : encodeHash(expectedHash);

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
        mockGetRedisClient.mockResolvedValue(null);
    });

    it("rejects a request with an invalid compliance hash", async () => {
        const res = await POST(signedRequest({ jobId: "job-1", url: "https://example.com" }, { badHash: true }));
        expect(res.status).toBe(401);
        expect(mockScrapingJob.upsert).not.toHaveBeenCalled();
    });

    it("never logs any part of the valid (expected) hash on a mismatch (roadmap 3.5 / S-16)", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const body = { jobId: "job-log", url: "https://example.com" };
        const timestamp = String(Date.now());
        const expectedHash = crypto
            .createHmac("sha256", SCRAPER_SECRET)
            .update(`${JSON.stringify(body)}.${timestamp}`)
            .digest("hex");

        await POST(signedRequest(body, { badHash: true, timestamp }));

        const logged = errorSpy.mock.calls.flat().map(String).join(" ");
        expect(logged).not.toContain(expectedHash.substring(0, 8));
        errorSpy.mockRestore();
    });

    it("rejects an exact replay of a signed request inside the window (roadmap 3.5 / S-16)", async () => {
        const body = { jobId: "job-replay", url: "https://example.com", teamId: "team-1" };
        const timestamp = String(Date.now());

        const first = await POST(signedRequest(body, { timestamp }));
        const replay = await POST(signedRequest(body, { timestamp }));

        expect(first.status).toBe(200);
        expect(replay.status).toBe(401);
        expect(mockScrapingJob.upsert).toHaveBeenCalledTimes(1);
        expect(mockProcessWebhookData).toHaveBeenCalledTimes(1);
    });

    it("rejects a replay whose hash is re-encoded (upper case / trailing junk) to dodge the cache", async () => {
        const body = { jobId: "job-replay-enc", url: "https://example.com", teamId: "team-1" };
        const timestamp = String(Date.now());

        const first = await POST(signedRequest(body, { timestamp }));
        const upper = await POST(signedRequest(body, { timestamp, encodeHash: (h) => h.toUpperCase() }));
        const junk = await POST(signedRequest(body, { timestamp, encodeHash: (h) => `${h}zz` }));

        expect(first.status).toBe(200);
        expect(upper.status).toBe(401);
        expect(junk.status).toBe(401);
        expect(mockScrapingJob.upsert).toHaveBeenCalledTimes(1);
    });

    it("rejects a signed request another api process already took (roadmap 3.1 / I-07)", async () => {
        const set = vi.fn().mockResolvedValue(null); // SET NX: the key is already there
        mockGetRedisClient.mockResolvedValue({ status: "ready", set });

        const res = await POST(signedRequest({ jobId: "job-other-process", url: "https://example.com", teamId: "team-1" }));

        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized: Replayed request" });
        expect(set).toHaveBeenCalledWith(
            expect.stringMatching(/^replay:scraper-ingest:[0-9a-f]{64}$/), "1", "PX", expect.any(Number), "NX",
        );
        expect(mockScrapingJob.upsert).not.toHaveBeenCalled();
    });

    it("accepts two distinct signed requests with the same body", async () => {
        const body = { jobId: "job-twice", url: "https://example.com", teamId: "team-1" };
        const now = Date.now();

        const first = await POST(signedRequest(body, { timestamp: String(now) }));
        const second = await POST(signedRequest(body, { timestamp: String(now + 1) }));

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
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

    it("rejects overwriting another team's existing job when the caller simply omits teamId (OPEN-224)", async () => {
        mockScrapingJob.findUnique.mockResolvedValue({ teamId: "team-a" });

        const res = await POST(signedRequest({ jobId: "job-1", url: "https://example.com" }));

        expect(res.status).toBe(409);
        expect(mockScrapingJob.upsert).not.toHaveBeenCalled();
    });
});
