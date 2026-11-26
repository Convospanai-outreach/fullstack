import { beforeEach, describe, expect, it, vi } from "vitest";
import { CorruptReplyPlanError, takeOverUnreadablePlan, type ReplyPlan } from "../replySubsequenceStore";

const m = vi.hoisted(() => ({
    read: vi.fn(), lock: vi.fn(), audit: vi.fn(), clear: vi.fn(), task: vi.fn(),
    enqueue: vi.fn(), encrypt: vi.fn(), notify: vi.fn(), lead: vi.fn(), team: vi.fn(), mailbox: vi.fn(), member: vi.fn(),
    findJob: vi.fn(), updateJob: vi.fn(), findCampaign: vi.fn(), latest: vi.fn(), judgement: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { team: { findUnique: m.team } } }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: m.enqueue } }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn(), encryptCredential: m.encrypt }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send: m.notify } }));
vi.mock("../replySubsequenceStore", () => ({
    readReplyPlan: m.read, lockReplyPlan: m.lock, saveReplyPlan: m.audit, clearQueuedReplyStep: m.clear,
    createReplyReviewTask: m.task, replyStepKey: () => "deterministic-step",
    CorruptReplyPlanError: class CorruptReplyPlanError extends Error {},
    takeOverUnreadablePlan: vi.fn(),
    replyReviewTaskId: () => "review-task-key",
    findReplyPlanOwner: () => "rep-a",
    isTerminalReplyStep: (step: { status: string }) => ["sent", "skipped", "cancelled"].includes(step.status),
}));

import { getReplyPlan, cancelReplySubsequenceForHumanAction, pauseReplySubsequence, seedReplySubsequence, updateReplyPlan } from "../replySubsequenceService";

const scope = { teamId: "team-a", leadId: "lead-a" };
const actor = "rep-a";
const envelope = { v: 1, cipher: "fixture-cipher", iv: "fixture-iv", tag: "fixture-tag" };
const hour = 3_600_000;
let plan: ReplyPlan;
let dueAt: number;

describe("human controls for reply follow-up plans", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        dueAt = Date.now() + hour;
        plan = {
            leadId: "lead-a", runId: "run-a", campaignId: "campaign-a", mailboxId: "mailbox-a", anchorId: "reply-a",
            ownerId: actor, classification: "INTERESTED", status: "active", reason: null, revision: 0,
            steps: [0, 48].map(offset => ({
                status: "draft", dueAt: dueAt + offset * hour, reason: null, revision: 0,
                approvedBy: null, sentAt: null, firstAttemptAt: null, holdSince: null, holdUntil: null,
            })),
        };
        m.read.mockResolvedValue(plan);
        m.team.mockResolvedValue({ sendSafety: { replyFlow: { followUpPlans: true, notifications: false } } });
        m.lead.mockResolvedValue({ email: "rep@example.test" });
        m.encrypt.mockResolvedValue(envelope);
        m.findCampaign.mockResolvedValue({ aiConfig: { dripPlaybook: { replySubsequence: { enabled: true, steps: [0, 48] } } }, status: "active" });
        m.mailbox.mockResolvedValue({ id: "mailbox-a" });
        m.member.mockResolvedValue({ id: "member-a" });
        m.lock.mockImplementation((_scope: unknown, action: (tx: unknown) => unknown) => action({
            job: { findUnique: m.findJob, update: m.updateJob }, task: { findUnique: vi.fn().mockResolvedValue(null) },
            lead: { findFirst: m.lead }, team: { findUnique: m.team }, campaign: { findFirst: m.findCampaign },
            connectedMailbox: { findFirst: m.mailbox }, teamMember: { findFirst: m.member },
            message: { findFirst: m.latest }, replyTracker: { findFirst: m.judgement },
        }));
    });

    it("creates one review task on first classification, with no send scheduled", async () => {
        const input = {
            ...scope, messageId: "run-a", receivedAt: new Date(), campaignId: "campaign-a", mailboxId: "mailbox-a",
            ownerId: actor, classification: "INTERESTED", confidence: 0.9,
            aiConfig: { dripPlaybook: { replySubsequence: { enabled: true, steps: [0, 48] } } },
        };
        m.read.mockResolvedValueOnce(null);
        await expect(seedReplySubsequence(input)).resolves.toBe(true);
        await expect(seedReplySubsequence(input)).resolves.toBe(true);
        expect(m.task).toHaveBeenCalledTimes(1);
        expect(m.enqueue).not.toHaveBeenCalled();
    });

    it("queues only the next step and seals the exact approved text, recipient and time", async () => {
        const content = "This text must go only into the vault.";
        await updateReplyPlan(scope, actor, { action: "approve", step: 0, content, dueAt, revision: 0 });
        expect(m.enqueue).toHaveBeenCalledWith("scheduled_inbox_reply", expect.objectContaining({
            approvedReply: envelope, userId: actor, replySubsequence: expect.objectContaining({ step: 0, revision: 1 }),
        }), expect.objectContaining({ idempotencyKey: "deterministic-step", processAt: new Date(dueAt) }));
        expect(JSON.stringify(m.enqueue.mock.calls)).not.toContain(content);
        expect(JSON.parse(m.encrypt.mock.calls[0]![0])).toMatchObject({ content, dueAt, recipient: "rep@example.test" });
        expect(plan.steps[0]?.status).toBe("queued");
        expect(m.audit).toHaveBeenCalledWith(expect.anything(), scope, plan, expect.objectContaining({ actorId: actor, action: "approved" }));
    });

    it("editing and rescheduling invalidate old approvals and replace the queue payload", async () => {
        plan.steps[0]!.status = "queued";
        plan.steps[0]!.approvedBy = actor;
        await updateReplyPlan(scope, actor, { action: "edit", step: 0, content: "Revised text" });
        expect(plan.steps[0]).toMatchObject({ revision: 1, approvedBy: null, status: "draft" });
        await updateReplyPlan(scope, actor, { action: "reschedule", step: 0, dueAt: dueAt + hour });
        m.findJob.mockResolvedValue({ id: "same-logical-step" });
        await updateReplyPlan(scope, actor, { action: "approve", step: 0, content: "Revised text", dueAt: dueAt + hour, revision: 2 });
        expect(m.updateJob).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "same-logical-step" },
            data: expect.objectContaining({ status: "queued", payload: expect.objectContaining({ approvedReply: envelope }) }) }));
        expect(m.enqueue).not.toHaveBeenCalled();
    });

    it("adjusts a send-window conflict before accepting the approval", async () => {
        const saturday = Date.parse("2026-11-28T05:00:00Z");
        plan.steps[1]!.dueAt = Date.parse("2026-12-03T12:00:00Z");
        m.team.mockResolvedValue({ sendSafety: {
            replyFlow: { followUpPlans: true, notifications: false },
            sendWindow: { enabled: true, days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18, timeZone: "UTC" },
        } });
        await updateReplyPlan(scope, actor, { action: "approve", step: 0, content: "Reviewed text", dueAt: saturday, revision: 0 });
        expect(plan.steps[0]).toMatchObject({ status: "draft", reason: "send_window" });
        expect(new Date(plan.steps[0]!.dueAt).getUTCDay()).toBe(1);
        expect(m.enqueue).not.toHaveBeenCalled();
    });

    it("rejects stale approval without clearing the current job", async () => {
        plan.steps[0]!.revision = 2;
        await expect(updateReplyPlan(scope, actor, { action: "approve", step: 0, content: "old", dueAt, revision: 1 }))
            .rejects.toMatchObject({ code: "STEP_NOT_READY" });
        expect(m.clear).not.toHaveBeenCalled();
    });

    it("requires explicit takeover to clear unreadable plan state", async () => {
        m.read.mockRejectedValue(new CorruptReplyPlanError());
        await expect(getReplyPlan(scope)).resolves.toMatchObject({ status: "corrupt" });
        await expect(updateReplyPlan(scope, actor, { action: "resume" }, "corrupt")).rejects.toMatchObject({ code: "PLAN_UNREADABLE" });
        await updateReplyPlan(scope, actor, { action: "takeover" }, "corrupt");
        expect(takeOverUnreadablePlan).toHaveBeenCalledWith(expect.anything(), scope, actor);
    });

    it("skips a step and creates a review task for the next", async () => {
        await updateReplyPlan(scope, actor, { action: "skip", step: 0 });
        expect(plan.steps[0]?.status).toBe("skipped");
        expect(m.task).toHaveBeenCalledWith(expect.anything(), scope, plan, "step:1", expect.any(String), expect.any(Date));
    });

    it("pauses, guards resume, and resumes only after reviewing the current reply", async () => {
        await updateReplyPlan(scope, actor, { action: "pause" });
        expect(plan.status).toBe("paused");
        m.findCampaign.mockResolvedValue({ aiConfig: { dripPlaybook: { replySubsequence: { enabled: true, steps: [0] } } }, status: "active" });
        await expect(updateReplyPlan(scope, actor, { action: "resume" })).rejects.toMatchObject({ code: "REPLY_NEEDS_REVIEW" });
        m.latest.mockResolvedValue({ id: "reply-b", content: "Tell me more", emailEvent: { email: { mailboxId: "mailbox-a" } } });
        m.judgement.mockResolvedValue({ aiClassification: "INTERESTED", aiConfidence: 0.95 });
        await updateReplyPlan(scope, actor, { action: "resume" });
        expect(plan).toMatchObject({ status: "active", anchorId: "reply-b" });
    });

    it.each(["cancel", "takeover"] as const)("%s clears queued steps and records who acted", async action => {
        plan.steps[0]!.status = "queued";
        await updateReplyPlan(scope, actor, { action });
        expect(plan.status).toBe("cancelled");
        expect(m.clear).toHaveBeenCalledWith(expect.anything(), scope, plan, 0);
        expect(m.audit).toHaveBeenCalledWith(expect.anything(), scope, plan, { action: "cancelled", actorId: actor, reason: action });
    });

    it("preserves an in-flight step while cancelling the remaining queue", async () => {
        plan.steps[0]!.status = "dispatching";
        plan.steps[0]!.firstAttemptAt = Date.now();
        plan.steps[1]!.status = "queued";
        await updateReplyPlan(scope, actor, { action: "cancel" });
        expect(plan.steps.map(step => step.status)).toEqual(["dispatching", "cancelled"]);
        expect(m.clear).toHaveBeenCalledTimes(1);
        expect(m.clear).toHaveBeenCalledWith(expect.anything(), scope, plan, 1);
    });

    it.each(["manual_reply", "manual_outcome", "manual_status_change"])("cancels queued steps after %s", async reason => {
        plan.steps[0]!.status = "queued";
        plan.steps[0]!.draft = envelope;
        await cancelReplySubsequenceForHumanAction(scope, actor, reason);
        expect(plan.steps[0]).toMatchObject({ status: "cancelled", approvedBy: null });
        expect(plan.steps[0]).not.toHaveProperty("draft");
        expect(m.audit).toHaveBeenCalledWith(expect.anything(), scope, plan, { action: "cancelled", actorId: actor, reason });
    });

    it.each(["new_inbound", "body_missing", "opt_out_language", "classification_changed", "classification_uncertain",
        "classification_unavailable", "thread_changed", "approval_stale", "hold_too_long", "team_master_off"])(
        "creates a decision task once for %s and clears approval",
        async reason => {
            plan.steps[0]!.status = "queued";
            await pauseReplySubsequence(scope, reason);
            await pauseReplySubsequence(scope, reason);
            expect(plan).toMatchObject({ status: "decision", reason });
            expect(plan.steps[0]?.status).toBe("draft");
            expect(m.task).toHaveBeenCalledTimes(1);
        },
    );
});
