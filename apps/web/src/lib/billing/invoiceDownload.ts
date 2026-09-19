import { getBrowserApiUrl } from "@/lib/api/browserBase";

type JobStatusResponse = {
    status: string;
    result?: { pdfBase64: string; filename: string } | null;
    error?: string | null;
};

export class InvoiceDownloadError extends Error {}

function base64ToBlob(base64: string): Blob {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
}

/**
 * Invoice PDFs render via a worker job (Chromium is not run in the api
 * container - roadmap.md item 1.6) rather than synchronously in the request.
 * This enqueues the render and polls /jobs/[id] until it succeeds.
 */
export async function downloadInvoiceViaJob(
    invoiceId: string,
    options: { fetchImpl?: typeof fetch; pollIntervalMs?: number; maxAttempts?: number } = {}
): Promise<{ blob: Blob; filename: string }> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const pollIntervalMs = options.pollIntervalMs ?? 1500;
    const maxAttempts = options.maxAttempts ?? 20;

    const renderRes = await fetchImpl(getBrowserApiUrl(`/billing/invoices/${invoiceId}/render`), { method: "POST" });
    if (!renderRes.ok) {
        throw new InvoiceDownloadError("Failed to start invoice generation");
    }
    const { jobId } = (await renderRes.json()) as { jobId: string };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const jobRes = await fetchImpl(getBrowserApiUrl(`/jobs/${jobId}`));
        if (!jobRes.ok) {
            throw new InvoiceDownloadError("Failed to check invoice generation status");
        }
        const job = (await jobRes.json()) as JobStatusResponse;

        if (job.status === "succeeded" && job.result?.pdfBase64) {
            return { blob: base64ToBlob(job.result.pdfBase64), filename: job.result.filename };
        }
        if (job.status === "dead_lettered") {
            throw new InvoiceDownloadError(job.error || "Invoice generation failed");
        }

        if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
    }

    throw new InvoiceDownloadError("Invoice generation timed out");
}
