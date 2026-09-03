import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAssertSafeWebhookUrl, mockAddDocument } = vi.hoisted(() => ({
    mockAssertSafeWebhookUrl: vi.fn(),
    mockAddDocument: vi.fn(),
}));

vi.mock("@/modules/webhooks/service/webhookService", () => ({
    assertSafeWebhookUrl: mockAssertSafeWebhookUrl,
}));

vi.mock("./vectorStore", () => ({
    vectorStore: { addDocument: mockAddDocument },
}));

import { ingestService } from "./ingest";

describe("IngestService.ingestUrl - SSRF guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("refuses to fetch a URL that resolves to a non-public address (SSRF)", async () => {
        mockAssertSafeWebhookUrl.mockRejectedValueOnce(new Error("Webhook URL resolves to a non-public address"));

        await expect(
            ingestService.ingestUrl("http://169.254.169.254/latest/meta-data/", "kb-1")
        ).rejects.toThrow("Webhook URL resolves to a non-public address");

        expect(mockAssertSafeWebhookUrl).toHaveBeenCalledWith("http://169.254.169.254/latest/meta-data/");
        expect(mockAddDocument).not.toHaveBeenCalled();
    });

    it("proceeds to fetch and ingest a URL that passes the safety check", async () => {
        mockAssertSafeWebhookUrl.mockResolvedValueOnce(undefined);
        mockAddDocument.mockResolvedValue({ id: "doc-1" });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => "<html><body>" + "Real page content here. ".repeat(10) + "</body></html>",
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await ingestService.ingestUrl("https://example.com/page", "kb-1");

        expect(mockAssertSafeWebhookUrl).toHaveBeenCalledWith("https://example.com/page");
        expect(fetchMock).toHaveBeenCalled();
        expect(result.length).toBeGreaterThan(0);

        vi.unstubAllGlobals();
    });
});
