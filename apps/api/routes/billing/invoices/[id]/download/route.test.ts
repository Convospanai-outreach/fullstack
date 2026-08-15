import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole, mockRenderInvoicePdf } = vi.hoisted(() => ({
    mockPrisma: {
        invoice: { findFirst: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockRenderInvoicePdf: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    authorizeRole: mockAuthorizeRole,
}));
vi.mock("@/modules/billing/service/invoicePdfRenderer", () => ({
    renderInvoicePdf: mockRenderInvoicePdf,
}));

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("/billing/invoices/[id]/download", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("404s when the invoice doesn't belong to the requester's team (no cross-team leakage)", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue(null);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/billing/invoices/inv-other-team/download") as any, params("inv-other-team"));

        expect(response.status).toBe(404);
        expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "inv-other-team", teamId: "team-1" },
        }));
        expect(mockRenderInvoicePdf).not.toHaveBeenCalled();
    });

    it("streams the rendered PDF with an attachment header for a valid invoice", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({
            id: "inv-1",
            invoiceNumber: "INV-pay_123",
            team: { name: "Acme" },
            user: { name: "Jane", email: "jane@acme.com" },
        });
        mockRenderInvoicePdf.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/billing/invoices/inv-1/download") as any, params("inv-1"));

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/pdf");
        expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="INV-pay_123.pdf"');
    });
});
