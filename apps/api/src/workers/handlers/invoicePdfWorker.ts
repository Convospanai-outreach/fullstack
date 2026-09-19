import { prisma } from "@/lib/db";
import { renderInvoicePdf } from "@/modules/billing/service/invoicePdfRenderer";
import { JobPayload } from "@/lib/queue";

/**
 * Runs Chromium (via renderInvoicePdf) on the worker only - not in the
 * api container, which serves live request traffic on a memory-constrained
 * VM (roadmap.md item 1.6).
 */
export async function handleInvoicePdfRender(payload: JobPayload) {
    const { invoiceId, teamId } = payload;
    if (!invoiceId || !teamId) {
        throw new Error("invoice_pdf_render payload is missing invoiceId/teamId");
    }

    // teamId is caller-supplied at enqueue time - re-verify ownership here too,
    // matching the defense-in-depth pattern in email-worker.ts.
    const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, teamId },
        include: { team: { select: { name: true } }, user: { select: { name: true, email: true } } },
    });
    if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found for team ${teamId}`);
    }

    const pdf = await renderInvoicePdf(invoice);

    return {
        pdfBase64: pdf.toString("base64"),
        filename: `${invoice.invoiceNumber}.pdf`,
    };
}
