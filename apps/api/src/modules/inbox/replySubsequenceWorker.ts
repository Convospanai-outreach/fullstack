import { z } from "zod";
import { accountReplyHoldUntil } from "@/lib/accountReplyCooldown";
import { APIError } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { readOptOut } from "@/lib/optOutReader";
import { JobClaimLostError, JobQueue, type JobClaim, type JobPayload } from "@/lib/queue";
import { resolveReplyFlowSettings } from "@/lib/replyFlowSettings";
import { decryptCredential } from "@/lib/security/credentialVault";
import { nextSendTime, resolveRecipientTimeZone, resolveSendWindow } from "@/lib/sendWindow";
import { assertMailboxCanSend, isSuppressed } from "@/modules/email-campaigner/service/googleMailboxService";
import { ReplyStepMailboxHoldError, sendReply, toPlainText } from "./actionInboxService";
import { decideReplySubsequence, readReplySubsequenceConfig, type ReplySubsequenceDecision } from "./replySubsequencePolicy";
import { pauseReplySubsequence, cancelReplySubsequenceForHumanAction, notifyReplyPlan } from "./replySubsequenceService";
import {
    CorruptReplyPlanError, createReplyReviewTask, isTerminalReplyStep, lockReplyPlan, readReplyPlan, replyStepKey, saveReplyPlan,

} from "./replySubsequenceStore";

const HOUR = 3_600_000;
const jobMetaSchema = z.object({ leadId: z.string(), runId: z.string(), step: z.number().int().min(0).max(3), revision: z.number().int() });
const approvalSchema = z.object({
    content: z.string().min(1).max(2200), recipient: z.string().min(1), approvedAt: z.number().int(), dueAt: z.number().int(),
});

export async function runReplySubsequenceStep(payload: JobPayload, claim: JobClaim) {
    const meta = jobMetaSchema.parse(payload.replySubsequence);
    const job = await prisma.job.findFirst({ where: { id: claim.jobId, version: claim.version, status: "running" } });
    if (!job?.teamId || job.teamId !== payload.teamId || !job.expiresAt || !payload.userId) throw new JobClaimLostError(claim.jobId);
    const scope = { teamId: job.teamId, leadId: meta.leadId };
    const plan = await readReplyPlan(scope).catch(error => {
        if (!(error instanceof CorruptReplyPlanError)) throw error;
        return "corrupt" as const;
    });
    if (plan === "corrupt") return { skipped: "plan_unreadable" };
    const step = plan?.steps[meta.step];
    if (!plan || !step || plan.runId !== meta.runId || step.revision !== meta.revision
        || step.approvedBy !== payload.userId || job.idempotencyKey !== replyStepKey(scope, plan.runId, meta.step)) {
        return { skipped: "approval_replaced" };
    }
    const approval = approvalSchema.parse(JSON.parse(await decryptCredential(payload.approvedReply) ?? "null"));
    if (approval.dueAt !== step.dueAt) return { skipped: "approval_replaced" };

    const alreadySent = await prisma.email.findUnique({
        where: { idempotencyKey: "inbox_reply_" + job.id, leadId: scope.leadId, campaign: { teamId: scope.teamId } },
        select: { createdAt: true },
    });
    const source = await prisma.message.findFirst({
        where: { id: plan.anchorId, direction: "INBOUND", platform: "EMAIL", leadId: scope.leadId, lead: { teamId: scope.teamId } },
        select: { content: true, createdAt: true, emailEvent: { select: { email: { select: { mailboxId: true } } } }, lead: {
            select: { email: true, domain: true, status: true, replyOutcome: true, phone: true, location: true, marketContext: true, team: { select: { sendSafety: true } } },
        } },
    });
    const now = Date.now();
    const earlierSteps = plan.steps.slice(0, meta.step);
    const lastSentAt = earlierSteps.reduce<number | null>((latest, item) => item.sentAt === null ? latest : Math.max(latest ?? 0, item.sentAt), null);
    const earlierJobs = earlierSteps.some(s => s.status === "sent") ? await prisma.job.findMany({
        where: { teamId: scope.teamId, idempotencyKey: { in: earlierSteps.flatMap((item, index) => item.status === "sent" ? [replyStepKey(scope, plan.runId, index)] : []) } },
        select: { id: true },
    }) : [];

    async function stop(decision: Exclude<ReplySubsequenceDecision, { kind: "send" }>) {
        if (step!.firstAttemptAt !== null) {
            // A missing Email row cannot tell us if Resend accepted the first call. Do not
            // relabel it as blocked or replay it when an updated safety check forbids sending.
            await pauseReplySubsequence(scope, "dispatch_unconfirmed", meta.step);
            return { dispatchUnconfirmed: true };
        }
        if (decision.kind === "cancel") {
            await cancelReplySubsequenceForHumanAction(scope, null, decision.reason);
            await prisma.job.updateMany({ where: { id: claim.jobId, version: claim.version, status: "running" },
                data: { status: "cancelled", payload: {}, completedAt: new Date(), version: { increment: 1 } } });
            return { replySubsequenceDeferred: true };
        }
        if (decision.kind === "hold") {
            const heldSince = step!.holdSince ?? now;
            await lockReplyPlan(scope, async tx => {
                const current = await readReplyPlan(scope, tx);
                const currentStep = current?.steps[meta.step];
                if (!current || !currentStep || current.runId !== meta.runId || currentStep.revision !== meta.revision || current.status !== "active") {
                    throw new JobClaimLostError(claim.jobId);
                }
                if (currentStep.reason !== decision.reason || currentStep.holdUntil !== decision.until) {
                    currentStep.status = "blocked";
                    currentStep.reason = decision.reason;
                    currentStep.holdSince = heldSince;
                    currentStep.holdUntil = decision.until;
                    await saveReplyPlan(tx, scope, current, { action: "blocked", actorId: null, reason: decision.reason, step: meta.step });
                    await createReplyReviewTask(tx, scope, current, `hold:${meta.step}:${currentStep.revision}`, "Review a held reply follow-up", new Date(decision.until));
                }
            });
            if (step!.holdSince === null) {
                await notifyReplyPlan(scope.teamId, plan!, "Reply follow-up held");
            }
            await JobQueue.defer(claim.jobId, claim.version, {
                processAt: new Date(Math.min(decision.until, heldSince + resolveReplyFlowSettings(source?.lead.team?.sendSafety).autoPause.holdHours * HOUR)), reason: "REPLY_SUBSEQUENCE_HELD",
            });
            return { replySubsequenceDeferred: true };
        }
        await lockReplyPlan(scope, async tx => {
            const current = await readReplyPlan(scope, tx);
            const currentStep = current?.steps[meta.step];
            if (!current || !currentStep || current.runId !== meta.runId || currentStep.revision !== meta.revision) return;
            currentStep.status = current.status === "cancelled" ? "cancelled" : "blocked";
            currentStep.reason = decision.reason;
            currentStep.approvedBy = null;
            currentStep.revision += 1;
            await saveReplyPlan(tx, scope, current, { action: "blocked", actorId: null, reason: decision.reason, step: meta.step });
        });
        if (decision.reason !== "plan_inactive") await pauseReplySubsequence(scope, decision.reason, meta.step);
        return { skipped: decision.reason };
    }

    if (!alreadySent) {
        if (!source) return stop({ kind: "block", reason: "mailbox_unavailable" });
        const [campaign, member, mailbox, newer, newerWhatsApp, judgement, suppressed, cooldown] = await Promise.all([
            prisma.campaign.findFirst({ where: { id: plan.campaignId, teamId: scope.teamId }, select: { aiConfig: true, status: true } }),
            prisma.teamMember.findFirst({ where: { userId: payload.userId, teamId: scope.teamId, status: "active" }, select: { id: true } }),
            assertMailboxCanSend(scope.teamId, plan.mailboxId),
            prisma.message.findFirst({ where: { id: { not: plan.anchorId }, leadId: scope.leadId, direction: "INBOUND", createdAt: { gte: source.createdAt } }, select: { id: true } }),
            prisma.whatsAppMessage.findFirst({
                where: { leadId: scope.leadId, lead: { teamId: scope.teamId }, createdAt: { gte: source.createdAt },
                    direction: { in: ["INBOUND", "OUTBOUND"] } },
                orderBy: { createdAt: "desc" }, select: { direction: true },
            }),
            prisma.replyTracker.findFirst({ where: { emailId: plan.anchorId, lead: { teamId: scope.teamId } }, select: { aiClassification: true, aiConfidence: true } }),
            isSuppressed(scope.teamId, approval.recipient),
            accountReplyHoldUntil({ ...scope, domain: source.lead.domain, settings: source.lead.team?.sendSafety, now: new Date(now) }),
        ]);
        const body = toPlainText(source.content);
        const settings = source.lead.team?.sendSafety;
        const replySettings = resolveReplyFlowSettings(settings);
        const window = resolveSendWindow(settings && typeof settings === "object" && !Array.isArray(settings) ? settings["sendWindow"] : null);
        const { timeZone } = resolveRecipientTimeZone(source.lead, window.timeZone);
        const nextWindow = nextSendTime(new Date(now), timeZone, window, job.id);
        const atMidnight = new Date(now);
        // The operational retry falls back to the next UTC day, never the worker's timezone.
        atMidnight.setUTCHours(24, 0, 0, 0);
        const limitAt = !mailbox.ok && (mailbox.code === "DAILY_LIMIT" || mailbox.code === "THROTTLED")
            ? mailbox.until?.getTime() ?? atMidnight.getTime() : null;
        const holds = [
            { until: cooldown?.getTime(), reason: "account_cooldown" as const },
            { until: nextWindow?.getTime(), reason: "send_window" as const },
            { until: limitAt ?? undefined, reason: "mailbox_limit" as const },
        ].sort((a, b) => (b.until ?? 0) - (a.until ?? 0));
        const hold = holds[0]!;
        const decision = decideReplySubsequence({
            now, approvalAt: approval.approvedAt, expiresAt: step.holdSince === null ? job.expiresAt.getTime() : Number.MAX_SAFE_INTEGER,
            lastSentAt, enabled: replySettings.followUpPlans && plan.steps.length <= replySettings.maxSteps && !!readReplySubsequenceConfig(campaign?.aiConfig), planActive: plan.status === "active",
            minimumConfidence: replySettings.autoPause.confidence, approvalHours: replySettings.approvalHours,
            holdHours: replySettings.autoPause.holdHours, minSpacingHours: replySettings.minSpacingHours,
            leadStatus: source.lead.status, outcome: source.lead.replyOutcome, recipientMatches: source.lead.email?.trim().toLowerCase() === approval.recipient,
            mailboxMatches: (mailbox.ok ? mailbox.mailbox?.provider === "RESEND" : limitAt !== null) && source.emailEvent?.email?.mailboxId === plan.mailboxId,
            campaignPaused: campaign?.status === "paused", suppressed, approverActive: !!member, newerInbound: !!newer || newerWhatsApp?.direction === "INBOUND", threadChanged: newerWhatsApp?.direction === "OUTBOUND",
            bodyAvailable: !!body, optOutLanguage: readOptOut({ body })?.class === "OPT_OUT",
            classification: judgement?.aiClassification ?? null, originalClassification: plan.classification, confidence: judgement?.aiConfidence ?? 0,
            ...(hold.until === undefined ? {} : { holdUntil: hold.until, holdReason: hold.reason }),
            ...(step.holdSince === null ? {} : { heldSince: step.holdSince }),
        });
        if (decision.kind !== "send") return stop(decision);
        if (step.holdSince !== null) return stop({ kind: "decision", reason: "sending_time_changed" });
        if (step.firstAttemptAt !== null && now - step.firstAttemptAt >= 12 * HOUR) {
            return stop({ kind: "decision", reason: "dispatch_unconfirmed" });
        }
    }

    try {
        await sendReply({
            teamId: scope.teamId, userId: payload.userId, messageId: plan.anchorId,
            content: approval.content, scheduledJobId: claim.jobId, expectedRecipient: approval.recipient,
            subsequence: {
                mailboxId: plan.mailboxId, earlierJobIds: earlierJobs.map(item => item.id),
                beforeProvider: async () => {
                    await lockReplyPlan(scope, async tx => {
                        const current = await readReplyPlan(scope, tx);
                        const currentStep = current?.steps[meta.step];
                        const running = await tx.job.findFirst({ where: { id: claim.jobId, version: claim.version, status: "running" }, select: { id: true } });
                        const [team, campaign] = await Promise.all([
                            tx.team.findUnique({ where: { id: scope.teamId }, select: { sendSafety: true } }),
                            tx.campaign.findFirst({ where: { id: plan.campaignId, teamId: scope.teamId }, select: { aiConfig: true, status: true } }),
                        ]);
                        const currentSettings = resolveReplyFlowSettings(team?.sendSafety);
                        if (!currentSettings.followUpPlans || !readReplySubsequenceConfig(campaign?.aiConfig) || campaign?.status === "paused"
                            || plan.steps.length > currentSettings.maxSteps) {
                            throw new APIError("Follow-up plans are disabled in Settings.", 409, "PLAN_DISABLED");
                        }
                        if (!running || !current || current.status !== "active" || current.runId !== meta.runId || currentStep?.revision !== meta.revision) {
                            throw new JobClaimLostError(claim.jobId);
                        }
                        if (Date.now() - approval.approvedAt > currentSettings.approvalHours * HOUR) {
                            throw new APIError("The approval expired.", 409, "PLAN_APPROVAL_STALE");
                        }
                        if (currentStep.firstAttemptAt === null) {
                            currentStep.firstAttemptAt = Date.now();
                            currentStep.status = "dispatching";
                            await saveReplyPlan(tx, scope, current, { action: "dispatch_started", actorId: null, reason: "approved_step", step: meta.step });
                        }
                    });
                },
            },
        });
    } catch (error) {
        if (error instanceof APIError && error.code === "PLAN_APPROVAL_STALE") return stop({ kind: "decision", reason: "approval_stale" });
        if (error instanceof APIError && error.code === "PLAN_DISABLED") return stop({ kind: "block", reason: "feature_off" });
        if (error instanceof APIError && error.code === "THREAD_CHANGED") return stop({ kind: "decision", reason: "thread_changed" });
        if (error instanceof ReplyStepMailboxHoldError) {
            const nextDay = new Date(now);
            nextDay.setUTCHours(24, 0, 0, 0);
            return stop({ kind: "hold", reason: "mailbox_limit", until: error.until?.getTime() ?? nextDay.getTime() });
        }
        if (!(error instanceof JobClaimLostError) && job.attempts >= job.maxAttempts) return stop({ kind: "decision", reason: "dispatch_unconfirmed" });
        if (error instanceof JobClaimLostError) throw error;
        throw new Error("Follow-up dispatch did not complete.");
    }

    await lockReplyPlan(scope, async tx => {
        const current = await readReplyPlan(scope, tx);
        const currentStep = current?.steps[meta.step];
        if (!current || !currentStep || current.runId !== meta.runId || currentStep.revision !== meta.revision || currentStep.status === "sent") return;
        currentStep.status = "sent";
        currentStep.sentAt = alreadySent?.createdAt.getTime() ?? Date.now();
        currentStep.reason = null;
        delete currentStep.draft;
        const next = current.steps.findIndex(item => !isTerminalReplyStep(item));
        if (next === -1 && current.status === "active") current.status = "completed";
        await saveReplyPlan(tx, scope, current, { action: "sent", actorId: payload.userId ?? null, reason: "provider_accepted", step: meta.step });
        if (next >= 0 && current.status === "active") {
            await createReplyReviewTask(tx, scope, current, `step:${next}`, "Review the next reply follow-up", new Date(current.steps[next]!.dueAt));
        }
    });
    return { sent: true };
}
