import { describe, expect, it, beforeAll, afterAll, vi, beforeEach, afterEach } from "vitest";

// These tests cover the guarded behavior, which is off unless the flag is set.
beforeEach(() => { vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true"); });
afterEach(() => { vi.unstubAllEnvs(); });
import { mailboxReputationIncidentOpen, mailboxSendingHold, type SendPurpose } from "./mailboxReputationHold";

const hold = (blocksReplies: boolean) => ({
    reputation: { sendingHold: { since: "2026-01-01T00:00:00Z", reason: "complaint", blocksReplies } },
});

describe("reputation hold policy", () => {
    it.each(["outreach", "scheduled_reply", "warmup"] satisfies SendPurpose[])("blocks %s without disconnecting the mailbox", (purpose) => {
        expect(mailboxSendingHold(hold(false), null, purpose)).toBe("MAILBOX_REPUTATION_HOLD");
    });

    it("never stops requested transactional mail on a mailbox hold", () => {
        expect(mailboxSendingHold(hold(true), null, "transactional")).toBeNull();
    });

    it("ignores a stored mailbox hold while the guard flag is off, so a stale hold cannot stick", () => {
        vi.unstubAllEnvs();
        expect(mailboxSendingHold(hold(true), null, "outreach")).toBeNull();
        expect(mailboxReputationIncidentOpen({ reputation: { state: "HELD" } })).toBe(false);
    });

    it("keeps the manual team hold live even with the guard flag off", () => {
        vi.unstubAllEnvs();
        expect(mailboxSendingHold(null, { reputation: { sendingHold: { reason: "provider issue" } } }, "transactional")).toBe("TEAM_SENDING_HOLD");
    });

    it("treats a mailbox as having an open incident only while the guard is on and the incident is not closed", () => {
        expect(mailboxReputationIncidentOpen({ reputation: { state: "OPEN" } })).toBe(true);
        expect(mailboxReputationIncidentOpen({ reputation: { state: "WARMING" } })).toBe(true);
        expect(mailboxReputationIncidentOpen({ reputation: { state: "RESOLVED" } })).toBe(false);
        expect(mailboxReputationIncidentOpen({ reputation: { state: "DISMISSED" } })).toBe(false);
        expect(mailboxReputationIncidentOpen({})).toBe(false);
    });

    it("permits a manual conversation reply unless the domain cannot safely send", () => {
        expect(mailboxSendingHold(hold(false), null, "conversation_reply")).toBeNull();
        expect(mailboxSendingHold(hold(true), null, "conversation_reply")).toBe("MAILBOX_REPUTATION_HOLD");
    });

    it("applies a platform hold even to conversation replies", () => {
        expect(mailboxSendingHold(null, { reputation: { sendingHold: { reason: "provider issue" } } }, "conversation_reply")).toBe("TEAM_SENDING_HOLD");
    });

    it("allows ordinary traffic when neither scope is held", () => {
        expect(mailboxSendingHold(null, null, "outreach")).toBeNull();
    });
});
