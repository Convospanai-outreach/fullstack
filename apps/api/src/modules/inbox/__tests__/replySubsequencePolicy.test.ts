import { describe, expect, it } from "vitest";
import { decideReplySubsequence, readReplySubsequenceConfig } from "../replySubsequencePolicy";

const now = Date.parse("2026-11-25T10:00:00Z");
const hour = 3_600_000;
const eligible = {
    now, approvalAt: now - hour, expiresAt: now + 12 * hour, lastSentAt: now - 24 * hour,
    enabled: true, planActive: true, leadStatus: "replied", outcome: null, recipientMatches: true,
    mailboxMatches: true, campaignPaused: false, suppressed: false, approverActive: true,
    newerInbound: false, threadChanged: false, bodyAvailable: true, optOutLanguage: false,
    classification: "INTERESTED", originalClassification: "INTERESTED", confidence: 0.9,
};

describe("reply subsequence settings", () => {
    it("defaults off and ignores invalid or unrecognized settings", () => {
        for (const replySubsequence of [undefined, { enabled: false, steps: [0, 24] },
            { enabled: true, steps: [0, 23] }, { enabled: true, steps: [0, 24, 48, 72, 96] },
            { enabled: true, steps: [0, 24], misspelledOption: true }]) {
            expect(readReplySubsequenceConfig({ dripPlaybook: { replySubsequence } })).toBeNull();
        }
        expect(readReplySubsequenceConfig({ dripPlaybook: { replySubsequence: { enabled: true, steps: [0, 24, 72, 96] } } }))
            .toEqual({ enabled: true, steps: [0, 24, 72, 96] });
    });
});

describe("reply subsequence send policy", () => {
    it("allows a reviewed and eligible step", () => {
        expect(decideReplySubsequence(eligible)).toEqual({ kind: "send" });
    });

    it.each([
        [{ newerInbound: true }, "new_inbound"], [{ threadChanged: true }, "thread_changed"],
        [{ classification: "QUESTION" }, "classification_changed"], [{ confidence: 0.69 }, "classification_uncertain"],
        [{ classification: null }, "classification_unavailable"], [{ bodyAvailable: false }, "body_missing"],
        [{ optOutLanguage: true }, "opt_out_language"], [{ approvalAt: now - 72 * hour - 1 }, "approval_stale"],
        [{ holdUntil: now + hour, heldSince: now - 24 * hour }, "hold_too_long"],
    ])("requires a decision for %j", (override, reason) => {
        expect(decideReplySubsequence({ ...eligible, ...override })).toEqual({ kind: "decision", reason });
    });

    it.each([
        [{ enabled: false }, "feature_off"], [{ planActive: false }, "plan_inactive"],
        [{ suppressed: true }, "recipient_suppressed"], [{ leadStatus: "BOUNCED" }, "lead_blocked"],
        [{ leadStatus: "DNC" }, "lead_blocked"], [{ leadStatus: "opt_out" }, "lead_blocked"],
        [{ leadStatus: "unsubscribed" }, "lead_blocked"],
        [{ outcome: "not_interested" }, "outcome_blocked"], [{ outcome: "wrong_person" }, "outcome_blocked"],
        [{ outcome: "meeting_booked" }, "outcome_blocked"], [{ outcome: "lost" }, "outcome_blocked"],
        [{ recipientMatches: false }, "recipient_changed"], [{ mailboxMatches: false }, "mailbox_unavailable"],
        [{ campaignPaused: true }, "campaign_paused"], [{ expiresAt: now }, "step_expired"],
    ])("blocks a step for %j", (override, reason) => {
        expect(decideReplySubsequence({ ...eligible, ...override })).toEqual({ kind: "block", reason });
    });

    it("cancels when the approving member leaves", () => {
        expect(decideReplySubsequence({ ...eligible, approverActive: false }))
            .toEqual({ kind: "cancel", reason: "approver_left" });
    });

    it("holds for account cooldown, mailbox limits, sending hours, and step spacing", () => {
        for (const holdReason of ["account_cooldown", "mailbox_limit", "send_window"] as const) {
            expect(decideReplySubsequence({ ...eligible, holdUntil: now + hour, holdReason }))
                .toEqual({ kind: "hold", reason: holdReason, until: now + hour });
        }
        expect(decideReplySubsequence({ ...eligible, lastSentAt: now - 23 * hour }))
            .toEqual({ kind: "hold", reason: "step_spacing", until: now + hour });
    });
});
