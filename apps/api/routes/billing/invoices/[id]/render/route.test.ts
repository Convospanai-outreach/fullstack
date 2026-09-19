import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole, mockEnqueue } = vi.hoisted(() => ({
    mockPrisma: {
        invoice: { findFirst: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    authorizeRole: mockAuthorizeRole,
}));
vi.mock("@/lib/queue", () => ({
    JobQueue: { enqueue: mockEnqueue },
}));

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /billing/invoices/[id]/render", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("404s when the invoice doesn't belong to the requester's team", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue(null);

        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/billing/invoices/inv-other-team/render", { method: "POST" }) as any, params("inv-other-team"));

        expect(response.status).toBe(404);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("enqueues an idempotent invoice_pdf_render job and returns its id/status", async () => {
        mockPrisma.invoice.findFirst.mockResolvedValue({ id: "inv-1" });
        mockEnqueue.mockResolvedValue({ id: "job-1", status: "queued" });

        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/billing/invoices/inv-1/render", { method: "POST" }) as any, params("inv-1"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ jobId: "job-1", status: "queued" });
        expect(mockEnqueue).toHaveBeenCalledWith(
            "invoice_pdf_render",
            { invoiceId: "inv-1", teamId: "team-1" },
            expect.objectContaining({ teamId: "team-1", idempotencyKey: "invoice_pdf_inv-1" })
        );
    });

    it("401s when unauthenticated", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/billing/invoices/inv-1/render", { method: "POST" }) as any, params("inv-1"));

        expect(response.status).toBe(401);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });
});
