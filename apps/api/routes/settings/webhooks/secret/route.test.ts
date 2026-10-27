import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockWriteAuditLog, mockDispatchAuditWebhook, mockPrisma } = vi.hoisted(() => {
    const tx = { webhook: { update: vi.fn() } };
    return {
        mockGetCurrentContext: vi.fn(),
        mockAuthorizeRole: vi.fn(),
        mockWriteAuditLog: vi.fn(),
        mockDispatchAuditWebhook: vi.fn(),
        mockPrisma: {
            tx,
            $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
        },
    };
});

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({ TeamRole: { ADMIN: "admin" }, authorizeRole: mockAuthorizeRole }));
vi.mock("@/lib/governance/audit", () => ({ writeAuditLog: mockWriteAuditLog, dispatchAuditWebhook: mockDispatchAuditWebhook }));

import { POST } from "./route";

function rotate(webhookId = "wh-1") {
    return POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ webhookId }) }) as any);
}

describe("settings/webhooks/secret route - rotation audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.tx.webhook.update.mockResolvedValue({});
        mockWriteAuditLog.mockResolvedValue({ id: "log-1", createdAt: new Date() });
        mockDispatchAuditWebhook.mockResolvedValue(undefined);
        mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(mockPrisma.tx));
    });

    it("rotates the secret and writes the audit row on the same transaction client", async () => {
        const res = await rotate();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.secret).toMatch(/^[a-f0-9]{64}$/);
        expect(mockPrisma.tx.webhook.update).toHaveBeenCalledWith({
            where: { id: "wh-1", teamId: "team-1" },
            data: { secret: body.secret },
        });
        expect(mockWriteAuditLog).toHaveBeenCalledWith(mockPrisma.tx, expect.objectContaining({ action: "WEBHOOK_SECRET_ROTATED", entityId: "wh-1" }));
        expect(JSON.stringify(mockWriteAuditLog.mock.calls)).not.toContain(body.secret);
        expect(mockDispatchAuditWebhook).toHaveBeenCalledTimes(1);
    });

    it("fails, and announces nothing, when the audit row cannot be written", async () => {
        mockWriteAuditLog.mockRejectedValue(new Error("audit table unavailable"));

        const res = await rotate();

        expect(res.status).toBe(500);
        expect(mockDispatchAuditWebhook).not.toHaveBeenCalled();
    });
});
