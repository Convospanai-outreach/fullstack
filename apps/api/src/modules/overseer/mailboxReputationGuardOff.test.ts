import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
    prisma: {
        connectedMailbox: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        email: { findFirst: vi.fn(), count: vi.fn() },
        emailEvent: { findFirst: vi.fn() },
        $executeRaw: vi.fn(),
        $transaction: vi.fn(),
    },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { evaluateMailboxReputation, requestMailboxReputationCheck, runMailboxReputationWatch } from "./mailboxReputation";
import { advanceMailboxWarmup } from "@/modules/email-campaigner/service/googleMailboxService";
import { actOnMailboxReputation, progressMailboxSwitches } from "./mailboxReputationActions";

// With MAILBOX_REPUTATION_GUARD unset, nothing in the automatic guard touches the database.
describe("reputation guard is inert while the flag is off", () => {
    beforeEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
    afterEach(() => { vi.unstubAllEnvs(); });

    it("does not evaluate a mailbox", async () => {
        await expect(evaluateMailboxReputation("team-1", "mailbox-1")).resolves.toBeNull();
        expect(prisma.connectedMailbox.findFirst).not.toHaveBeenCalled();
    });

    it("does not run the daily sweep", async () => {
        await expect(runMailboxReputationWatch()).resolves.toBe(0);
        expect(prisma.connectedMailbox.findMany).not.toHaveBeenCalled();
    });

    it("does not queue a webhook-triggered check", async () => {
        await expect(requestMailboxReputationCheck("team-1", "mailbox-1")).resolves.toBeUndefined();
        expect(prisma.connectedMailbox.findFirst).not.toHaveBeenCalled();
    });

    it("does not progress sender switches", async () => {
        await expect(progressMailboxSwitches()).resolves.toBeUndefined();
        expect(prisma.connectedMailbox.findMany).not.toHaveBeenCalled();
    });

    it("does not accept or run replacement actions with the flag unset", async () => {
        await expect(actOnMailboxReputation("team-1", "mailbox-1", "admin", { action: "switch", replacementId: "next" }))
            .rejects.toMatchObject({ code: "REPUTATION_GUARD_DISABLED" });
        expect(prisma.connectedMailbox.findFirst).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("keeps the original calendar ramp without consulting activity or changing warmup metadata", async () => {
        const now = new Date("2026-11-25T10:00:00.000Z");
        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);
        prisma.connectedMailbox.updateMany.mockResolvedValue({ count: 1 });
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        expect(prisma.connectedMailbox.updateMany).toHaveBeenCalledWith({
            where: {
                status: "CONNECTED", isWarmingUp: true, warmupDay: { lt: 30 },
                OR: [{ warmupLastAdvancedAt: null }, { warmupLastAdvancedAt: { lt: midnight } }],
            },
            data: { warmupDay: { increment: 1 }, warmupLastAdvancedAt: expect.any(Date) },
        });
        expect(prisma.connectedMailbox.findMany).not.toHaveBeenCalled();
        expect(prisma.email.findFirst).not.toHaveBeenCalled();
        expect(prisma.emailEvent.findFirst).not.toHaveBeenCalled();
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it("only reads a flag set to exactly true", async () => {
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", "1");
        await runMailboxReputationWatch();
        expect(prisma.connectedMailbox.findMany).not.toHaveBeenCalled();
    });
});
