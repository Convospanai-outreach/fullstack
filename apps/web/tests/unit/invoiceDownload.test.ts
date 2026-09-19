import { describe, expect, it, vi } from "vitest";
import { downloadInvoiceViaJob, InvoiceDownloadError } from "@/lib/billing/invoiceDownload";

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: async () => body } as Response;
}

describe("downloadInvoiceViaJob", () => {
    it("throws when the render request fails to start", async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ error: "boom" }, false));

        await expect(downloadInvoiceViaJob("inv-1", { fetchImpl })).rejects.toThrow(InvoiceDownloadError);
    });

    it("polls until the job succeeds and decodes the resulting PDF", async () => {
        const pdfBase64 = Buffer.from("%PDF-1.4 fake").toString("base64");
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jobId: "job-1" }))
            .mockResolvedValueOnce(jsonResponse({ status: "queued" }))
            .mockResolvedValueOnce(jsonResponse({ status: "succeeded", result: { pdfBase64, filename: "INV-1.pdf" } }));

        const { blob, filename } = await downloadInvoiceViaJob("inv-1", { fetchImpl, pollIntervalMs: 0 });

        expect(filename).toBe("INV-1.pdf");
        expect(blob.type).toBe("application/pdf");
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("throws when the job is dead-lettered", async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jobId: "job-1" }))
            .mockResolvedValueOnce(jsonResponse({ status: "dead_lettered", error: "chromium crashed" }));

        await expect(downloadInvoiceViaJob("inv-1", { fetchImpl, pollIntervalMs: 0 })).rejects.toThrow(/chromium crashed/);
    });

    it("throws a timeout error after exhausting max attempts", async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jobId: "job-1" }))
            .mockResolvedValue(jsonResponse({ status: "queued" }));

        await expect(
            downloadInvoiceViaJob("inv-1", { fetchImpl, pollIntervalMs: 0, maxAttempts: 3 })
        ).rejects.toThrow(/timed out/);
        expect(fetchImpl).toHaveBeenCalledTimes(4); // 1 render + 3 polls
    });
});
