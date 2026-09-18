import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckAdmin, mockPrisma } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    mockPrisma: {
        user: { findUnique: vi.fn() },
        subscription: { findUnique: vi.fn() },
        invoice: { findMany: vi.fn() },
        creditLedger: { findMany: vi.fn() },
        lLMUsageLog: { groupBy: vi.fn() },
        auditLog: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/admin", () => ({ checkAdmin: mockCheckAdmin }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("super admin user detail route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckAdmin.mockResolvedValue(true);
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            email: "user@example.com",
            name: "User One",
            role: "user",
            enterpriseRole: "SALES_USER",
            credits: 50,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            memberships: [{ teamId: "team-1", role: "owner", status: "active", team: { id: "team-1", name: "Team One" } }],
        });
        mockPrisma.subscription.findUnique.mockResolvedValue(null);
        mockPrisma.invoice.findMany.mockResolvedValue([]);
        mockPrisma.creditLedger.findMany.mockResolvedValue([]);
        mockPrisma.lLMUsageLog.groupBy.mockResolvedValue([]);
        mockPrisma.auditLog.findMany.mockResolvedValue([]);
    });

    it("rejects non-super admins", async () => {
        mockCheckAdmin.mockResolvedValue(false);
        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/admin/super/users/user-1"), params("user-1"));

        expect(response.status).toBe(403);
    });

    it("404s for an unknown user", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/admin/super/users/missing"), params("missing"));

        expect(response.status).toBe(404);
    });

    it("returns user detail with team, invoices, and LLM usage", async () => {
        mockPrisma.invoice.findMany.mockResolvedValue([
            { id: "inv-1", invoiceNumber: "INV-1", type: "subscription", description: "Pro plan", amount: 2900, currency: "usd", gateway: "STRIPE", status: "paid", createdAt: new Date() },
        ]);
        mockPrisma.lLMUsageLog.groupBy.mockResolvedValueOnce([
            { provider: "openai", _sum: { tokensIn: 100, tokensOut: 50, cost: 0.1 }, _count: { _all: 3 } },
        ]).mockResolvedValueOnce([
            { model: "gpt-4o-mini", _sum: { tokensIn: 100, tokensOut: 50, cost: 0.1 }, _count: { _all: 3 } },
        ]);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/admin/super/users/user-1?range=30d"), params("user-1"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.email).toBe("user@example.com");
        expect(body.teams).toEqual([{ id: "team-1", name: "Team One", role: "owner", status: "active" }]);
        expect(body.invoices[0]).toMatchObject({ invoiceNumber: "INV-1", amount: 2900 });
        expect(body.llmUsage.byProvider[0]).toMatchObject({ provider: "openai", requests: 3 });
    });

    it("marks an active subscription as pastDue once its period has lapsed", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue({
            status: "active",
            currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"),
            gateway: "RAZORPAY",
            createdAt: new Date("2019-01-01T00:00:00.000Z"),
            plan: { name: "PRO", monthlyPrice: 2900 },
        });

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/admin/super/users/user-1"), params("user-1"));
        const body = await response.json();

        expect(body.subscription).toMatchObject({ status: "active", pastDue: true, planName: "PRO" });
    });
});
