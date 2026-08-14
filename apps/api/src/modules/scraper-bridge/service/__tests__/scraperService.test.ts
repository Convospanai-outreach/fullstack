import { beforeEach, describe, expect, it, vi } from "vitest";

const { linkedInScrape, genericScrape } = vi.hoisted(() => ({
    linkedInScrape: vi.fn(),
    genericScrape: vi.fn(),
}));

vi.mock("../adapters/linkedinAdapter", () => ({
    LinkedInAdapter: class {
        scrape = linkedInScrape;
    },
}));

vi.mock("../adapters/genericAdapter", () => ({
    GenericAdapter: class {
        scrape = genericScrape;
    },
}));

describe("scraperService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("dispatches linkedin targets to LinkedInAdapter and wraps the result", async () => {
        linkedInScrape.mockResolvedValue({ name: "Ada Lovelace" });
        const { scraperService } = await import("../scraperService");

        const result = await scraperService.scrape({ target: "linkedin", url: "https://linkedin.com/in/ada" });

        expect(linkedInScrape).toHaveBeenCalledWith("https://linkedin.com/in/ada");
        expect(genericScrape).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ name: "Ada Lovelace" });
        expect(typeof result.signalId).toBe("string");
    });

    it("dispatches non-linkedin targets to GenericAdapter", async () => {
        genericScrape.mockResolvedValue({ content: "<html></html>" });
        const { scraperService } = await import("../scraperService");

        const result = await scraperService.scrape({ target: "generic", url: "https://example.com" });

        expect(genericScrape).toHaveBeenCalledWith("https://example.com");
        expect(linkedInScrape).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ content: "<html></html>" });
    });

    it("propagates adapter failures instead of swallowing them", async () => {
        linkedInScrape.mockRejectedValue(new Error("navigation timeout"));
        const { scraperService } = await import("../scraperService");

        await expect(
            scraperService.scrape({ target: "linkedin", url: "https://linkedin.com/in/ada" })
        ).rejects.toThrow("navigation timeout");
    });

    it("batchScrape runs each request through the same dispatch logic", async () => {
        linkedInScrape.mockResolvedValue({ name: "Ada" });
        genericScrape.mockResolvedValue({ content: "ok" });
        const { scraperService } = await import("../scraperService");

        const results = await scraperService.batchScrape([
            { target: "linkedin", url: "https://linkedin.com/in/ada" },
            { target: "generic", url: "https://example.com" },
        ]);

        expect(results).toHaveLength(2);
        expect(results[0]?.data).toEqual({ name: "Ada" });
        expect(results[1]?.data).toEqual({ content: "ok" });
    });

    it("batchScrape returns an empty array if any request fails", async () => {
        linkedInScrape.mockRejectedValue(new Error("boom"));
        const { scraperService } = await import("../scraperService");

        const results = await scraperService.batchScrape([{ target: "linkedin", url: "https://linkedin.com/in/ada" }]);

        expect(results).toEqual([]);
    });
});
