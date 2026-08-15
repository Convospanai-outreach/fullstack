import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole } = vi.hoisted(() => ({
    mockPrisma: {
        invoice: { findMany: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    authorizeRole: mockAuthorizeRole,
}));

describe("/billing/invoices", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("returns 401 when unauthenticated", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/billing/invoices") as any);
        expect(response.status).toBe(401);
        expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it("scopes the query to the requester's team", async () => {
        mockPrisma.invoice.findMany.mockResolvedValue([{ id: "inv-1", invoiceNumber: "INV-pay_1" }]);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/billing/invoices") as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: "team-1" },
        }));
        expect(payload.invoices).toEqual([{ id: "inv-1", invoiceNumber: "INV-pay_1" }]);
    });
});
