import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
    prisma: {
        connectedMailbox: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        $transaction: vi.fn(),
    },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { evaluateMailboxReputation, requestMailboxReputationCheck, runMailboxReputationWatch } from "./mailboxReputation";
import { progressMailboxSwitches } from "./mailboxReputationActions";

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

    it("only reads a flag set to exactly true", async () => {
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", "1");
        await runMailboxReputationWatch();
        expect(prisma.connectedMailbox.findMany).not.toHaveBeenCalled();
    });
});
