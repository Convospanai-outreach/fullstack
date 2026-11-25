import { describe, expect, it } from "vitest";
import { mailboxSendingHold, type SendPurpose } from "./mailboxReputationHold";

const hold = (blocksReplies: boolean) => ({
    reputation: { sendingHold: { since: "2026-01-01T00:00:00Z", reason: "complaint", blocksReplies } },
});

describe("reputation hold policy", () => {
    it.each(["outreach", "scheduled_reply", "warmup", "transactional"] satisfies SendPurpose[])("blocks %s without disconnecting the mailbox", (purpose) => {
        expect(mailboxSendingHold(hold(false), null, purpose)).toBe("MAILBOX_REPUTATION_HOLD");
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
