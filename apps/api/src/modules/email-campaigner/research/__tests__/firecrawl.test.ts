import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirecrawlError, firecrawlPost } from "../firecrawl";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fail = (status: number, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ success: false, error: `HTTP ${status} text` }), { status, headers });

const saved = { ...process.env };
beforeEach(() => {
    process.env["FIRECRAWL_API_KEY"] = "fc-test";
});
afterEach(() => {
    process.env = { ...saved };
});

describe("firecrawlPost", () => {
    it("posts JSON with the bearer key and returns the parsed body", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(ok({ success: true, data: { x: 1 } }));
        const out = await firecrawlPost<{ data: { x: number } }>("/search", { query: "a" }, fetchImpl as any, async () => {});
        expect(out.data.x).toBe(1);
        const [url, init] = fetchImpl.mock.calls[0]!;
        expect(url).toBe("https://api.firecrawl.dev/v2/search");
        expect(init.headers.Authorization).toBe("Bearer fc-test");
        expect(JSON.parse(init.body)).toEqual({ query: "a" });
    });

    it("does not retry a 402 (no credits) and flags it not retryable", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(fail(402));
        await expect(firecrawlPost("/scrape", {}, fetchImpl as any, async () => {})).rejects.toMatchObject({ status: 402, retryable: false });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("retries a 429 after Retry-After seconds, then succeeds", async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(fail(429, { "retry-after": "2" })).mockResolvedValueOnce(ok({ success: true }));
        const sleep = vi.fn().mockResolvedValue(undefined);
        await firecrawlPost("/search", {}, fetchImpl as any, sleep);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledWith(2000);
    });

    it("caps the Retry-After wait", async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(fail(429, { "retry-after": "600" })).mockResolvedValueOnce(ok({}));
        const sleep = vi.fn().mockResolvedValue(undefined);
        await firecrawlPost("/search", {}, fetchImpl as any, sleep);
        expect(sleep).toHaveBeenCalledWith(5000);
    });

    it("gives up after three attempts on a 500", async () => {
        const fetchImpl = vi.fn().mockImplementation(async () => fail(500));
        await expect(firecrawlPost("/search", {}, fetchImpl as any, async () => {})).rejects.toBeInstanceOf(FirecrawlError);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("retries a network failure", async () => {
        const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("socket hang up")).mockResolvedValueOnce(ok({ success: true }));
        await firecrawlPost("/search", {}, fetchImpl as any, async () => {});
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("fails without calling out when no key is set", async () => {
        delete process.env["FIRECRAWL_API_KEY"];
        const fetchImpl = vi.fn();
        await expect(firecrawlPost("/search", {}, fetchImpl as any, async () => {})).rejects.toMatchObject({ retryable: false });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
