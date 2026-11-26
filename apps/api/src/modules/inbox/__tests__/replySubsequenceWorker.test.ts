import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    job: vi.fn(), email: vi.fn(), message: vi.fn(), whatsApp: vi.fn(), campaign: vi.fn(), member: vi.fn(), judgement: vi.fn(),
    readPlan: vi.fn(), savePlan: vi.fn(), lock: vi.fn(), task: vi.fn(), pause: vi.fn(),
    hold: vi.fn(), mailbox: vi.fn(), suppress: vi.fn(), send: vi.fn(), decrypt: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
    whatsAppMessage: { findFirst: m.whatsApp }, job: { findFirst: m.job }, email: { findUnique: m.email }, message: { findFirst: m.message },
    campaign: { findFirst: m.campaign }, teamMember: { findFirst: m.member }, replyTracker: { findFirst: m.judgement },
} }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: m.decrypt }));
vi.mock("@/lib/accountReplyCooldown", () => ({ accountReplyHoldUntil: m.hold }));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({ assertMailboxCanSend: m.mailbox, isSuppressed: m.suppress }));
vi.mock("../actionInboxService", () => ({ ReplyStepMailboxHoldError: class ReplyStepMailboxHoldError extends Error {}, sendReply: m.send, toPlainText: (body: string) => body }));
vi.mock("../replySubsequenceService", () => ({ pauseReplySubsequence: m.pause }));
vi.mock("../replySubsequenceStore", () => ({
    CorruptReplyPlanError: class CorruptReplyPlanError extends Error {},
    readReplyPlan: m.readPlan, lockReplyPlan: m.lock, saveReplyPlan: m.savePlan, createReplyReviewTask: m.task,
    replyStepKey: () => "step-key",
    isTerminalReplyStep: (step: { status: string }) => step.status === "sent",
}));

import { CorruptReplyPlanError } from "../replySubsequenceStore";
import { runReplySubsequenceStep } from "../replySubsequenceWorker";

const scope = { teamId: "team-a", leadId: "lead-a" };
const claim = { jobId: "job-a", version: 4 };
const payload = { ...scope, userId: "rep-a", replySubsequence: { leadId: "lead-a", runId: "run-a", step: 0, revision: 1 } };

describe("scheduled follow-up dispatch", () => {
    // The worker applies the team's send window to the real clock; pin it inside the window so the result does not
    // depend on the time of day the suite runs (outside the window a step is held instead of dispatched).
    beforeAll(() => { vi.useFakeTimers({ now: new Date("2026-11-25T10:00:00Z"), toFake: ["Date"] }); });
    afterAll(() => { vi.useRealTimers(); });

    beforeEach(() => {
        vi.resetAllMocks();
        const now = Date.now();
        m.job.mockResolvedValue({ teamId: "team-a", id: "job-a", idempotencyKey: "step-key", expiresAt: new Date(now + 100_000), attempts: 1, maxAttempts: 3 });
        m.readPlan.mockResolvedValue({
            runId: "run-a", ownerId: "rep-a", status: "active", mailboxId: "mailbox-a", campaignId: "campaign-a", anchorId: "inbound-a",
            classification: "INTERESTED", steps: [{ revision: 1, approvedBy: "rep-a", holdSince: null, firstAttemptAt: null, dueAt: now }],
        });
        m.decrypt.mockResolvedValue(JSON.stringify({ content: "Reviewed text", recipient: "review@example.test", approvedAt: now - 1000, dueAt: now }));
        m.email.mockResolvedValue(null);
        m.message.mockResolvedValueOnce({
            content: "Tell me more", createdAt: new Date(now - 1000), emailEvent: { email: { mailboxId: "mailbox-a" } },
            lead: { email: "review@example.test", status: "replied", replyOutcome: null, team: { sendSafety: {} } },
        }).mockResolvedValue(null);
        m.campaign.mockResolvedValue({ status: "active", aiConfig: { dripPlaybook: { replySubsequence: { enabled: true, steps: [0] } } } });
        m.member.mockResolvedValue({ id: "member-a" });
        m.mailbox.mockResolvedValue({ ok: true, mailbox: { provider: "RESEND" } });
        m.judgement.mockResolvedValue({ aiClassification: "INTERESTED", aiConfidence: 1 });
        m.suppress.mockResolvedValue(false);
        m.hold.mockResolvedValue(null);
        m.lock.mockImplementation(async (_scope: unknown, action: (tx: unknown) => unknown) => action({}));
    });

    it("blocks a queued, approved step when the team master is off at send time", async () => {
        await expect(runReplySubsequenceStep(payload, claim)).resolves.toEqual({ skipped: "feature_off" });
        expect(m.send).not.toHaveBeenCalled();
        expect(m.pause).toHaveBeenCalledWith(scope, "feature_off", 0);
    });

    it("understands WhatsApp replies stored separately from the email thread", async () => {
        const source = await m.message();
        m.message.mockResolvedValueOnce({ ...source, lead: { ...source.lead,
            team: { sendSafety: { replyFlow: { followUpPlans: true } } } } });
        m.whatsApp.mockResolvedValueOnce({ direction: "INBOUND" });
        await expect(runReplySubsequenceStep(payload, claim)).resolves.toEqual({ skipped: "new_inbound" });
        expect(m.send).not.toHaveBeenCalled();
        expect(m.pause).toHaveBeenCalledWith(scope, "new_inbound", 0);
    });

    it("does not relabel an unconfirmed provider dispatch as blocked after a new reply", async () => {
        const plan = await m.readPlan();
        const current = await m.message();
        const source = { ...current, lead: { ...current.lead, team: { sendSafety: { replyFlow: { followUpPlans: true } } } } };
        m.message.mockResolvedValueOnce(source).mockResolvedValueOnce(null);
        m.lock.mockImplementation(async (_scope: unknown, action: (tx: unknown) => unknown) => action({
            job: { findFirst: m.job }, campaign: { findFirst: m.campaign },
            team: { findUnique: async () => ({ sendSafety: source.lead.team.sendSafety }) },
        }));
        m.send.mockImplementationOnce(async input => {
            await input.subsequence.beforeProvider();
            throw new Error("Provider accepted the message, but the Email write failed");
        });
        await expect(runReplySubsequenceStep(payload, claim)).rejects.toThrow("Follow-up dispatch did not complete.");
        expect(plan.steps[0].status).toBe("dispatching");
        m.message.mockResolvedValueOnce(source).mockResolvedValueOnce({ id: "new-reply" });
        await expect(runReplySubsequenceStep(payload, claim)).resolves.toEqual({ dispatchUnconfirmed: true });
        expect(plan.steps[0].status).toBe("dispatching");
        expect(m.pause).toHaveBeenCalledWith(scope, "dispatch_unconfirmed", 0);
        expect(m.send).toHaveBeenCalledTimes(1);
    });

    it("blocks dispatch for an unreadable plan", async () => {
        m.readPlan.mockRejectedValueOnce(new CorruptReplyPlanError());
        await expect(runReplySubsequenceStep(payload, claim)).resolves.toEqual({ skipped: "plan_unreadable" });
        expect(m.send).not.toHaveBeenCalled();
    });

    it("ignores a worker claim for an approval revision that was replaced", async () => {
        await expect(runReplySubsequenceStep({ ...payload, replySubsequence: { ...payload.replySubsequence, revision: 0 } }, claim))
            .resolves.toEqual({ skipped: "approval_replaced" });
        expect(m.send).not.toHaveBeenCalled();
        expect(m.decrypt).not.toHaveBeenCalled();
    });
});
