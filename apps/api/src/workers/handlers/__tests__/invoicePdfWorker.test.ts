import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockRenderInvoicePdf } = vi.hoisted(() => ({
    mockPrisma: {
        invoice: { findFirst: vi.fn() },
    },
    mockRenderInvoicePdf: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/billing/service/invoicePdfRenderer", () => ({
    renderInvoicePdf: mockRenderInvoicePdf,
}));

describe("handleInvoicePdfRender", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when invoiceId/teamId is missing from the payload", async () => {
        const { handleInvoicePdfRender } = await import("../invoicePdfWorker");
        await expect(handleInvoicePdfRender({} as any)).rejects.toThrow(/missing invoiceId\/teamId/);
        expect(mockPrisma.invoice.findFirst).not.toHaveBeenCalled();
    });

    it("throws when the invoice doesn't belong to the payload's team (defense in depth)", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue(null);

        const { handleInvoicePdfRender } = await import("../invoicePdfWorker");
        await expect(handleInvoicePdfRender({ invoiceId: "inv-1", teamId: "team-1" } as any)).rejects.toThrow(/not found for team/);
        expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "inv-1", teamId: "team-1" },
        }));
        expect(mockRenderInvoicePdf).not.toHaveBeenCalled();
    });

    it("renders the PDF and returns it base64-encoded with a filename", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({
            id: "inv-1",
            invoiceNumber: "INV-pay_123",
            team: { name: "Acme" },
            user: { name: "Jane", email: "jane@acme.com" },
        });
        mockRenderInvoicePdf.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));

        const { handleInvoicePdfRender } = await import("../invoicePdfWorker");
        const result = await handleInvoicePdfRender({ invoiceId: "inv-1", teamId: "team-1" } as any);

        expect(result.filename).toBe("INV-pay_123.pdf");
        expect(Buffer.from(result.pdfBase64, "base64").toString()).toBe("%PDF-1.4 fake");
    });
});
