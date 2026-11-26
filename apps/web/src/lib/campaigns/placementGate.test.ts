import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
    campaignSequence: { findMany: vi.fn() }, connectedMailbox: { findMany: vi.fn() },
    campaign: { findFirst: vi.fn() }, team: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { checkPlacementGate, isBlockingPlacement } from "./placementGate";

const now = new Date("2026-11-25T12:00:00Z");
const red = (extra: Record<string, unknown> = {}) => ({ placement: { status: "done", checkedAt: "2026-11-24T12:00:00Z", verdict: { level: "red", reasons: [] }, ...extra } });

describe("isBlockingPlacement", () => {
    it("blocks only a fresh, finished, red result nobody accepted", () => {
        expect(isBlockingPlacement(red(), now)).toBe(true);
        expect(isBlockingPlacement(red({ override: { by: "u1", at: "2026-11-24T13:00:00Z" } }), now)).toBe(false);
        expect(isBlockingPlacement(red({ checkedAt: "2026-11-01T00:00:00Z" }), now)).toBe(false);
        expect(isBlockingPlacement(red({ status: "running" }), now)).toBe(false);
        expect(isBlockingPlacement(red({ verdict: { level: "amber" } }), now)).toBe(false);
    });

    it("never blocks a mailbox without a check or with unreadable metadata", () => {
        expect(isBlockingPlacement(null, now)).toBe(false);
        expect(isBlockingPlacement({ inboundDomain: "in.acme.test" }, now)).toBe(false);
        expect(isBlockingPlacement({ placement: "garbage" }, now)).toBe(false);
        expect(isBlockingPlacement(red({ checkedAt: "not a date" }), now)).toBe(false);
    });
});

describe("checkPlacementGate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", undefined);
        db.team.findUnique.mockResolvedValue(null);
        db.campaign.findFirst.mockResolvedValue(null);
        db.campaignSequence.findMany.mockResolvedValue([]);
    });
    afterEach(() => vi.unstubAllEnvs());

    it("checks the sequences' chosen senders only", async () => {
        db.campaignSequence.findMany.mockResolvedValue([{ senderMailboxIds: ["m1"] }, { senderMailboxIds: ["m1", "m2"] }]);
        db.connectedMailbox.findMany.mockResolvedValue([{ id: "m1", email: "a@acme.test", metadata: null }]);
        expect(await checkPlacementGate("t1", "c1", now)).toEqual({ allowed: true });
        expect(db.connectedMailbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1", status: "CONNECTED", id: { in: ["m1", "m2"] } } }));
    });

    it.each([undefined, "true"])("blocks starts for a manual team hold with flag %s", async (flag) => {
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", flag);
        db.team.findUnique.mockResolvedValue({ sendSafety: { reputation: { sendingHold: { reason: "admin hold" } } } });
        expect(await checkPlacementGate("t1", "c1", now)).toMatchObject({ allowed: false, status: 409, body: { code: "TEAM_SENDING_HOLD" } });
        expect(db.connectedMailbox.findMany).not.toHaveBeenCalled();
    });

    it("gates an explicitly configured held sender only when enabled", async () => {
        db.campaign.findFirst.mockResolvedValue({ aiConfig: { senderMailboxId: "m1" } });
        db.connectedMailbox.findMany.mockResolvedValue([
            { id: "m1", email: "a@acme.test", metadata: { reputation: { sendingHold: { reason: "reputation" } } } },
        ]);
        expect(await checkPlacementGate("t1", "c1", now)).toEqual({ allowed: true });
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true");
        expect(await checkPlacementGate("t1", "c1", now)).toMatchObject({ allowed: false, body: {
            code: "MAILBOX_REPUTATION_HOLD", mailboxes: [{ id: "m1", email: "a@acme.test" }],
        } });
        expect(db.connectedMailbox.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ["m1"] } }) }));
    });

    it("allows automatic sender selection when an unheld mailbox is available", async () => {
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true");
        db.connectedMailbox.findMany.mockResolvedValue([
            { id: "m1", email: "a@acme.test", metadata: { reputation: { sendingHold: { reason: "reputation" } } } },
            { id: "m2", email: "b@acme.test", metadata: null },
        ]);
        expect(await checkPlacementGate("t1", "c1", now)).toEqual({ allowed: true });
    });

    it("falls back to every connected mailbox and blocks with 409 when one is red", async () => {
        db.campaignSequence.findMany.mockResolvedValue([]);
        db.connectedMailbox.findMany.mockResolvedValue([
            { id: "m1", email: "a@acme.test", metadata: null },
            { id: "m2", email: "b@acme.test", metadata: red() },
        ]);
        const gate = await checkPlacementGate("t1", "c1", now);
        expect(db.connectedMailbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1", status: "CONNECTED" } }));
        expect(gate).toMatchObject({ allowed: false, status: 409, body: { code: "PLACEMENT_RED", mailboxes: [{ id: "m2", email: "b@acme.test" }] } });
    });
});
