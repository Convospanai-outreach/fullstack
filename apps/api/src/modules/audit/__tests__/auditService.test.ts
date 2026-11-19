import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: { auditLog: { create: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { AuditService } from "../auditService";

const written = () => mockPrisma.auditLog.create.mock.calls[0][0].data;

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
});

describe("AuditService.log actor", () => {
    // AuditLog.userId is a foreign key to User. Any placeholder string ("SYSTEM") is rejected by the
    // database, and log() swallows that error, so the audit row would silently never exist.
    it("stores a system action (no user) with a null actor, never a placeholder string", async () => {
        await AuditService.log("team-1", null, "CONVERSATION_STATE_CHANGE", "ConversationThread", "th-1", {});

        expect(written().actorId).toBeNull();
        expect(written().orgId).toBe("team-1");
    });

    it("keeps the real user id when there is one", async () => {
        await AuditService.log("team-1", "user-1", "USER_LOGIN", "User", "user-1", {});

        expect(written().actorId).toBe("user-1");
    });

    it("still does not throw when the write fails, unless strict", async () => {
        mockPrisma.auditLog.create.mockRejectedValue(new Error("fk"));
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(AuditService.log("team-1", null, "X", "Y", null, {})).resolves.toBeUndefined();
        await expect(AuditService.log("team-1", null, "X", "Y", null, {}, null, null, true)).rejects.toThrow("fk");
        spy.mockRestore();
    });
});
