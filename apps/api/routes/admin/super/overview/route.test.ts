import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckAdmin, mockPrisma } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    mockPrisma: {
        user: { findMany: vi.fn() },
        team: { findMany: vi.fn() },
        apiKey: { findMany: vi.fn() },
        lLMUsageLog: { groupBy: vi.fn() },
        creditTransaction: { groupBy: vi.fn() },
        auditLog: { count: vi.fn(), findMany: vi.fn() },
        systemEvent: { count: vi.fn(), findMany: vi.fn() },
    },
}));

vi.mock("@/lib/admin", () => ({
    checkAdmin: mockCheckAdmin,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

describe("super admin overview route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckAdmin.mockResolvedValue(true);
        mockPrisma.user.findMany.mockResolvedValue([
            {
                id: "user-1",
                email: "admin@example.com",
                name: "Admin",
                role: "admin",
                enterpriseRole: "SYSTEM_ADMIN",
                credits: 10,
                createdAt: new Date("2026-06-01T00:00:00.000Z"),
                updatedAt: new Date("2026-06-02T00:00:00.000Z"),
                memberships: [{ teamId: "team-1", role: "owner", status: "active", team: { id: "team-1", name: "Team One" } }],
                creditLedger: [{ amount: -3, createdAt: new Date() }],
            },
        ]);
        mockPrisma.team.findMany.mockResolvedValue([
            {
                id: "team-1",
                name: "Team One",
                credits: 100,
                createdAt: new Date("2026-06-01T00:00:00.000Z"),
                members: [{ id: "member-1" }],
                leads: [{ id: "lead-1" }],
                campaigns: [{ id: "campaign-1" }],
                apiKeys: [{ id: "key-1", name: "Prod", scopes: ["leads:read"], isActive: true, lastUsedAt: new Date("2026-06-03T00:00:00.000Z"), createdAt: new Date() }],
            },
        ]);
        mockPrisma.apiKey.findMany.mockResolvedValue([
            { id: "key-1", name: "Prod", scopes: ["leads:read"], isActive: true, lastUsedAt: null, createdAt: new Date(), teamId: "team-1", team: { name: "Team One" } },
        ]);
        mockPrisma.lLMUsageLog.groupBy
            .mockResolvedValueOnce([{ teamId: "team-1", _sum: { tokensIn: 100, tokensOut: 50, cost: 0.25 }, _count: { _all: 2 }, _avg: { latency: 100 } }])
            .mockResolvedValueOnce([{ actorId: "user-1", _sum: { tokensIn: 80, tokensOut: 40, cost: 0.2 }, _count: { _all: 1 } }])
            .mockResolvedValueOnce([{ provider: "openai", _sum: { tokensIn: 100, tokensOut: 50, cost: 0.25 }, _count: { provider: 2 } }])
            .mockResolvedValueOnce([{ model: "gpt-4o-mini", _sum: { tokensIn: 100, tokensOut: 50, cost: 0.25 }, _count: { model: 2 } }]);
        mockPrisma.creditTransaction.groupBy.mockResolvedValue([{ teamId: "team-1", type: "usage", _sum: { amount: -5 } }]);
        mockPrisma.auditLog.count.mockResolvedValue(1);
        mockPrisma.systemEvent.count.mockResolvedValue(1);
        mockPrisma.auditLog.findMany.mockResolvedValue([]);
        mockPrisma.systemEvent.findMany.mockResolvedValue([]);
    });

    it("rejects non-super admins", async () => {
        mockCheckAdmin.mockResolvedValue(false);
        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/admin/super/overview"));

        expect(response.status).toBe(403);
    });

    it("returns global usage and platform totals", async () => {
        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/admin/super/overview?range=30d"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.totals).toMatchObject({
            users: 1,
            teams: 1,
            activeApiKeys: 1,
            llmRequests: 2,
            tokensIn: 100,
            tokensOut: 50,
            tokenCost: 0.25,
        });
        expect(body.users[0]).toMatchObject({ email: "admin@example.com", usageAttribution: "user", llmRequests: 1 });
        expect(body.apiKeys[0]).toMatchObject({ name: "Prod", teamName: "Team One" });
    });
});
