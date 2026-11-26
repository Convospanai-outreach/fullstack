import { z } from "zod";
import { APIError } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { nextSendTime, resolveRecipientTimeZone } from "@/lib/sendWindow";
import { readReplySendingWindow, resolveReplyFlowSettings } from "@/lib/replyFlowSettings";
import { decryptCredential, encryptCredential } from "@/lib/security/credentialVault";
import { readReplySubsequenceConfig } from "./replySubsequencePolicy";
import {
    clearQueuedReplyStep, createReplyReviewTask, isTerminalReplyStep, lockReplyPlan,
    readReplyPlan, replyStepKey, replyReviewTaskId, findReplyPlanOwner, saveReplyPlan, REPLY_PLAN_TYPE, REPLY_PLAN_STATUS, type ReplyPlan, type ReplyPlanScope, type ReplyPlanTx, CorruptReplyPlanError, takeOverUnreadablePlan,
} from "./replySubsequenceStore";

const HOUR = 3_600_000;
const ELIGIBLE_CLASSES = new Set(["INTERESTED", "QUESTION", "OOO"]);

const withStep = { step: z.number().int().min(0).max(3) };
const text = z.string().trim().min(1).max(2200);
export const replyPlanActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("edit"), ...withStep, content: text }),
    z.object({ action: z.literal("approve"), ...withStep, content: text, dueAt: z.number().int(), revision: z.number().int() }),
    z.object({ action: z.literal("reschedule"), ...withStep, dueAt: z.number().int() }),
    z.object({ action: z.literal("skip"), ...withStep }),
    z.object({ action: z.literal("pause") }),
    z.object({ action: z.literal("resume") }),
    z.object({ action: z.literal("cancel") }),
    z.object({ action: z.literal("takeover") }),
]);

export type ReplyPlanAction = z.infer<typeof replyPlanActionSchema>;

async function alignReplyPlanTime(tx: ReplyPlanTx, scope: ReplyPlanScope, rawSettings: unknown, dueAt: number, key: string) {
    const window = readReplySendingWindow(rawSettings);
    if (!window.enabled) return dueAt;
    const lead = await tx.lead.findFirst({
        where: { id: scope.leadId, teamId: scope.teamId },
        select: { location: true, phone: true, marketContext: true },
    });
    const { timeZone } = resolveRecipientTimeZone(lead, window.timeZone);
    return nextSendTime(new Date(dueAt), timeZone, window, key)?.getTime() ?? dueAt;
}

export async function notifyReplyPlan(teamId: string, plan: ReplyPlan, title: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
    if (!resolveReplyFlowSettings(team?.sendSafety).notifications) return;
    const recipientId = await findReplyPlanOwner(prisma, teamId, plan.ownerId);
    if (!recipientId) return;
    const { NotificationDispatcher } = await import("@/lib/notifications");
    await NotificationDispatcher.send(recipientId, "LEAD", title, "Open the Inbox thread to review the follow-up plan.", { messageId: plan.anchorId });
}

export async function seedReplySubsequence(input: ReplyPlanScope & {
    messageId: string; receivedAt: Date; campaignId: string; mailboxId: string;
    ownerId: string | null; aiConfig: unknown; classification: string; confidence: number; draftResponse?: string;
}) {
    const config = readReplySubsequenceConfig(input.aiConfig);
    if (!config || !ELIGIBLE_CLASSES.has(input.classification) || !(input.confidence >= 0.7)) return false;
    return lockReplyPlan(input, async tx => {
        const team = await tx.team.findUnique({ where: { id: input.teamId }, select: { sendSafety: true } });
        const settings = resolveReplyFlowSettings(team?.sendSafety);
        if (!settings.followUpPlans || input.confidence < settings.autoPause.confidence || config.steps.length > settings.maxSteps
            || config.steps.some((offset, index) => index > 0 && offset - config.steps[index - 1]! < settings.minSpacingHours)) return false;
        const previous = await readReplyPlan(input, tx);
        if (previous?.runId === input.messageId) return true;
        if (previous && previous.status !== "completed" && previous.status !== "cancelled") return true;
        const singleReply = await tx.job.findUnique({
            where: { idempotencyKey: "scheduled_inbox_reply:" + input.teamId + ":" + input.messageId },
            select: { status: true },
        });
        if (singleReply && ["queued", "pending", "running", "processing"].includes(singleReply.status)) return false;
        const priorReview = await tx.task.findUnique({
            where: { id: replyReviewTaskId(input, input.messageId, "step:0") }, select: { id: true },
        });
        if (priorReview) return true;
        const [mailbox, owner] = await Promise.all([
            tx.connectedMailbox.findFirst({ where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED", provider: "RESEND" }, select: { id: true } }),
            findReplyPlanOwner(tx, input.teamId, input.ownerId),
        ]);
        if (!mailbox || !owner) return false;
        const firstDraft = input.draftResponse?.trim() ? await encryptCredential(input.draftResponse.trim().slice(0, 2200)) : undefined;
        const steps: ReplyPlan["steps"] = [];
        for (const [index, offset] of config.steps.entries()) {
            const requested = input.receivedAt.getTime() + offset * HOUR;
            const dueAt = await alignReplyPlanTime(tx, input, team?.sendSafety,
                Math.max(requested, (steps.at(-1)?.dueAt ?? 0) + settings.minSpacingHours * HOUR),
                replyStepKey(input, input.messageId, index));
            steps.push({
                ...(index === 0 && firstDraft ? { draft: firstDraft } : {}),
                dueAt, status: "draft", reason: null, revision: 0,
                approvedBy: null, firstAttemptAt: null, holdSince: null, holdUntil: null, sentAt: null,
            });
        }
        const plan: ReplyPlan = {
            runId: input.messageId, leadId: input.leadId, campaignId: input.campaignId, mailboxId: input.mailboxId, anchorId: input.messageId,
            ownerId: owner, classification: input.classification, status: "active", reason: null, revision: 0,
            steps,
        };
        await saveReplyPlan(tx, input, plan, { action: "created", actorId: null, reason: "eligible_inbound_reply" });
        await createReplyReviewTask(tx, input, plan, "step:0", "Review the first reply follow-up", new Date(plan.steps[0]!.dueAt));
        return true;
    });
}

async function clearQueue(tx: ReplyPlanTx, scope: ReplyPlanScope, plan: ReplyPlan, state: "draft" | "cancelled", exceptStep?: number) {
    for (const [index, step] of plan.steps.entries()) {
        if (index === exceptStep || isTerminalReplyStep(step) || step.status === "dispatching") continue;
        await clearQueuedReplyStep(tx, scope, plan, index);
        step.status = state;
        step.revision += 1;
        step.approvedBy = null;
        if (state === "cancelled") delete step.draft;
    }
}

export async function pauseReplySubsequence(scope: ReplyPlanScope, reason: string, exceptStep?: number) {
    const changed = await lockReplyPlan(scope, async tx => {
        const plan = await readReplyPlan(scope, tx);
        if (!plan || plan.status === "cancelled" || plan.status === "completed" || (plan.status === "decision" && plan.reason === reason)) return null;
        await clearQueue(tx, scope, plan, "draft", exceptStep);
        plan.status = "decision";
        plan.reason = reason;
        await saveReplyPlan(tx, scope, plan, { action: "paused", actorId: null, reason });
        await createReplyReviewTask(tx, scope, plan, `decision:${plan.revision}`, "Decide how to continue the reply follow-up", new Date());
        return plan;
    });
    if (changed) await notifyReplyPlan(scope.teamId, changed, "Reply follow-up needs your decision");
}

export async function cancelReplySubsequenceForHumanAction(scope: ReplyPlanScope, actorId: string | null, reason: string) {
    const existing = await readReplyPlan(scope);
    if (!existing || existing.status === "completed" || existing.status === "cancelled") return;
    await lockReplyPlan(scope, async tx => {
        const plan = await readReplyPlan(scope, tx);
        if (!plan || plan.status === "completed" || plan.status === "cancelled") return;
        await clearQueue(tx, scope, plan, "cancelled");
        plan.status = "cancelled";
        plan.reason = reason;
        await saveReplyPlan(tx, scope, plan, { action: "cancelled", actorId, reason });
    });
}

export async function onLeadHumanAction(teamId: string, leadId: string, actorId: string | null, reason: string) {
    const scope = { teamId, leadId };
    if (reason === "buyer_signal") await pauseReplySubsequence(scope, reason);
    else await cancelReplySubsequenceForHumanAction(scope, actorId, reason);
}

export async function reactToReplyClassification(scope: ReplyPlanScope, messageId: string, classification: string, confidence: number) {
    const plan = await readReplyPlan(scope);
    if (!plan || plan.status === "cancelled" || plan.status === "completed") return;
    const team = await prisma.team.findUnique({ where: { id: scope.teamId }, select: { sendSafety: true } });
    const threshold = resolveReplyFlowSettings(team?.sendSafety).autoPause.confidence;
    const reason = classification === "DNC" ? "opt_out_language"
        : classification === "UNSURE" ? "classification_unavailable"
            : !(confidence >= threshold) ? "classification_uncertain"
                : classification !== plan.classification ? "classification_changed"
                    : messageId !== plan.anchorId ? "new_inbound" : null;
    if (reason) await pauseReplySubsequence(scope, reason);
}

export async function reactToInboundReply(message: { id: string; leadId: string; content?: string }) {
    const lead = await prisma.lead.findUnique({ where: { id: message.leadId }, select: { teamId: true } });
    if (!lead?.teamId) return;
    const scope = { teamId: lead.teamId, leadId: message.leadId };
    const plan = await readReplyPlan(scope);
    if (!plan || plan.anchorId === message.id || plan.status === "completed" || plan.status === "cancelled") return;
    const { readOptOut } = await import("@/lib/optOutReader");
    const body = message.content?.trim() ?? "";
    const reason = !body ? "body_missing" : readOptOut({ body })?.class === "OPT_OUT" ? "opt_out_language" : "new_inbound";
    await pauseReplySubsequence(scope, reason);
}

export async function pauseTeamReplySubsequences(teamId: string) {
    const rows = await prisma.job.findMany({
        where: { teamId, type: REPLY_PLAN_TYPE, status: REPLY_PLAN_STATUS, payload: { path: ["status"], equals: "active" } },
        select: { payload: true },
    });
    for (const row of rows) {
        const leadId = (row.payload as { leadId?: unknown })?.leadId;
        if (typeof leadId === "string") await pauseReplySubsequence({ teamId, leadId }, "team_master_off");
    }
}

export async function replyPlanScope(teamId: string, messageId: string): Promise<ReplyPlanScope> {
    const message = await prisma.message.findFirst({
        where: { id: messageId, direction: "INBOUND", lead: { teamId } }, select: { leadId: true },
    });
    if (!message) throw new APIError("Reply not found.", 404, "REPLY_NOT_FOUND");
    return { teamId, leadId: message.leadId };
}

export async function sendReplySubsequenceNotice(input: ReplyPlanScope & { runId: string; step: number; revision: number }) {
    const plan = await readReplyPlan(input);
    const step = plan?.steps[input.step];
    if (!plan || plan.runId !== input.runId || plan.status !== "active" || step?.status !== "queued" || step.revision !== input.revision) return;
    const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { sendSafety: true } });
    if (!resolveReplyFlowSettings(team?.sendSafety).followUpPlans) return;
    await notifyReplyPlan(input.teamId, plan, "An approved reply follow-up is due within an hour");
}

export async function getReplyPlan(scope: ReplyPlanScope) {
    const plan = await readReplyPlan(scope).catch(error => {
        if (!(error instanceof CorruptReplyPlanError)) throw error;
        return "corrupt" as const;
    });
    if (plan === "corrupt") return { status: "corrupt", runId: "corrupt", reason: "plan_unreadable", steps: [], history: [] };
    if (!plan) return null;
    const history = await prisma.auditLog.findMany({
        where: { orgId: scope.teamId, entity: "ReplySubsequence", entityId: plan.runId },
        orderBy: { createdAt: "desc" },
        select: { action: true, metadata: true, createdAt: true, user: { select: { name: true } } },
        take: 50,
    });
    const steps = await Promise.all(plan.steps.map(async ({ draft, dueAt, holdUntil, status, reason, revision }) => ({
        dueAt, holdUntil, status, reason, revision, content: status === "draft" && draft ? await decryptCredential(draft) ?? "" : "",
    })));
    return { runId: plan.runId, status: plan.status, reason: plan.reason, steps, history };
}

export async function updateReplyPlan(scope: ReplyPlanScope, userId: string, action: ReplyPlanAction, expectedRunId?: string) {
    const notify = await lockReplyPlan(scope, async tx => {
        const plan = await readReplyPlan(scope, tx).catch(error => {
            if (!(error instanceof CorruptReplyPlanError)) throw error;
            return "corrupt" as const;
        });
        if (plan === "corrupt") {
            if (action.action !== "takeover" || expectedRunId !== "corrupt") throw new APIError("Plan unreadable. Take over this conversation.", 409, "PLAN_UNREADABLE");
            await takeOverUnreadablePlan(tx, scope, userId);
            return null;
        }
        if (!plan || plan.status === "cancelled" || plan.status === "completed") {
            throw new APIError("This follow-up plan is closed.", 409, "PLAN_CLOSED");
        }
        if (expectedRunId && expectedRunId !== plan.runId) throw new APIError("Refresh this follow-up plan.", 409, "PLAN_CHANGED");
        const team = await tx.team.findUnique({ where: { id: scope.teamId }, select: { sendSafety: true } });
        const settings = resolveReplyFlowSettings(team?.sendSafety);
        if ((action.action === "approve" || action.action === "resume") && !settings.followUpPlans) {
            throw new APIError("Enable follow-up plans in Settings before continuing.", 409, "PLAN_DISABLED");
        }
        if (!("step" in action)) {
            if (action.action === "cancel" || action.action === "takeover") {
                await clearQueue(tx, scope, plan, "cancelled");
                plan.status = "cancelled";
            } else if (action.action === "pause") {
                await clearQueue(tx, scope, plan, "draft");
                plan.status = "paused";
            } else {
                if (plan.steps.some(step => step.status === "dispatching")) {
                    throw new APIError("A follow-up may already have been sent. Take over this conversation to continue manually.", 409, "DISPATCH_UNCONFIRMED");
                }
                const campaign = await tx.campaign.findFirst({
                    where: { id: plan.campaignId, teamId: scope.teamId }, select: { aiConfig: true, status: true },
                });
                if (!readReplySubsequenceConfig(campaign?.aiConfig) || campaign?.status === "paused") {
                    throw new APIError("Enable the playbook and resume its campaign before resuming the follow-up.", 409, "PLAN_DISABLED");
                }
                const latest = await tx.message.findFirst({
                    where: { leadId: scope.leadId, direction: "INBOUND", platform: "EMAIL", lead: { teamId: scope.teamId } },
                    orderBy: { createdAt: "desc" },
                    select: { id: true, content: true, emailEvent: { select: { email: { select: { mailboxId: true } } } } },
                });
                const verdict = latest ? await tx.replyTracker.findFirst({
                    where: { emailId: latest.id, leadId: scope.leadId }, select: { aiClassification: true, aiConfidence: true },
                }) : null;
                const { readOptOut } = await import("@/lib/optOutReader");
                if (!latest?.content.trim() || latest.emailEvent?.email?.mailboxId !== plan.mailboxId
                    || !verdict || !ELIGIBLE_CLASSES.has(verdict.aiClassification) || verdict.aiConfidence < settings.autoPause.confidence
                    || readOptOut({ body: latest.content })?.class === "OPT_OUT") {
                    throw new APIError("The latest reply needs review before the plan can resume.", 409, "REPLY_NEEDS_REVIEW");
                }
                plan.anchorId = latest.id;
                plan.classification = verdict.aiClassification;
                plan.status = "active";
            }
            plan.reason = action.action;
            await saveReplyPlan(tx, scope, plan, { action: ({ cancel: "cancelled", takeover: "cancelled", pause: "paused", resume: "resumed" })[action.action], actorId: userId, reason: action.action });
            return action.action === "pause" ? plan : null;
        }

        const step = plan.steps[action.step];
        if (!step || isTerminalReplyStep(step) || step.status === "dispatching") {
            throw new APIError("That step can no longer be changed.", 409, "STEP_CLOSED");
        }
        if (action.action === "approve" && (plan.status !== "active" || plan.steps.length > settings.maxSteps
            || plan.steps.findIndex(s => !isTerminalReplyStep(s)) !== action.step
            || action.revision !== step.revision || step.firstAttemptAt !== null)) {
            throw new APIError("Refresh the plan and review the next available step.", 409, "STEP_NOT_READY");
        }
        await clearQueuedReplyStep(tx, scope, plan, action.step);
        step.revision += 1;
        step.approvedBy = null;
        step.reason = null;
        step.holdSince = null;
        step.holdUntil = null;
        step.status = "draft";
        if (action.action === "edit") step.draft = await encryptCredential(action.content);
        if (action.action === "skip") {
            step.status = "skipped";
            delete step.draft;
            if (plan.steps.every(isTerminalReplyStep)) plan.status = "completed";
        }
        if (action.action === "approve" || action.action === "reschedule") {
            const previous = plan.steps[action.step - 1];
            const next = plan.steps[action.step + 1];
            const previousTime = previous?.sentAt ?? previous?.dueAt;
            if (!Number.isFinite(new Date(action.dueAt).getTime())) throw new APIError("Choose a valid send time.", 400, "STEP_TIME");
            const dueAt = await alignReplyPlanTime(tx, scope, team?.sendSafety, action.dueAt, replyStepKey(scope, plan.runId, action.step));
            if ( (previousTime != null && dueAt < previousTime + settings.minSpacingHours * HOUR)
                || (next && !isTerminalReplyStep(next) && next.dueAt < dueAt + settings.minSpacingHours * HOUR)) {
                throw new APIError("Follow-up steps must be scheduled at least 24 hours apart.", 400, "STEP_SPACING");
            }
            step.dueAt = dueAt;
            if (action.action === "approve" && dueAt !== action.dueAt) {
                step.draft = await encryptCredential(action.content);
                step.reason = "send_window";
                await saveReplyPlan(tx, scope, plan, { action: "edited", actorId: userId, reason: "send_window", step: action.step });
                return null;
            }
        }
        if (action.action === "approve") {
            const campaign = await tx.campaign.findFirst({
                where: { id: plan.campaignId, teamId: scope.teamId }, select: { aiConfig: true, status: true },
            });
            if (!readReplySubsequenceConfig(campaign?.aiConfig) || campaign?.status === "paused") {
                throw new APIError("Enable the playbook and resume its campaign before scheduling a follow-up.", 409, "PLAN_DISABLED");
            }
            const lead = await tx.lead.findFirst({ where: { id: scope.leadId, teamId: scope.teamId }, select: { email: true } });
            if (!lead?.email) throw new APIError("The lead needs an email address.", 409, "LEAD_EMAIL_MISSING");
            const singleReply = await tx.job.findUnique({
                where: { idempotencyKey: "scheduled_inbox_reply:" + scope.teamId + ":" + plan.anchorId },
                select: { status: true },
            });
            if (singleReply && ["queued", "pending", "running", "processing"].includes(singleReply.status)) {
                throw new APIError("Cancel the one-off scheduled reply before approving this step.", 409, "REPLY_ALREADY_SCHEDULED");
            }
            const approvedAt = Date.now();
            const approvedReply = await encryptCredential(JSON.stringify({
                content: action.content, recipient: lead.email.trim().toLowerCase(), approvedAt, dueAt: step.dueAt,
            }));
            const payload = {
                teamId: scope.teamId, userId, messageId: plan.anchorId, approvedReply,
                replySubsequence: { leadId: scope.leadId, runId: plan.runId, step: action.step, revision: step.revision },
            };
            const idempotencyKey = replyStepKey(scope, plan.runId, action.step);
            const existing = await tx.job.findUnique({ where: { idempotencyKey } });
            const processAt = new Date(Math.max(approvedAt, step.dueAt));
            const expiresAt = new Date(processAt.getTime() + 12 * HOUR);
            if (settings.notifications) {
                await JobQueue.enqueue("reply_subsequence_notice", { ...scope, runId: plan.runId, step: action.step, revision: step.revision }, {
                    teamId: scope.teamId, idempotencyKey: idempotencyKey + ":notice:" + step.revision,
                    processAt: new Date(Math.max(approvedAt, processAt.getTime() - HOUR)), client: tx,
                });
            }
            if (existing) {
                await tx.job.update({ where: { id: existing.id }, data: {
                    payload, processAt, expiresAt, status: "queued", attempts: 0, version: { increment: 1 },
                    completedAt: null, startedAt: null, heartbeatAt: null, error: null,
                } });
            } else {
                await JobQueue.enqueue("scheduled_inbox_reply", payload, { teamId: scope.teamId, idempotencyKey, processAt, expiresAt, client: tx });
            }
            step.draft = await encryptCredential(action.content);
            step.status = "queued";
            step.approvedBy = userId;
        }
        await saveReplyPlan(tx, scope, plan, {
            action: ({ approve: "approved", edit: "edited", reschedule: "edited", skip: "skipped" })[action.action],
            actorId: userId, reason: action.action, step: action.step,
        });
        const next = plan.steps.findIndex(s => !isTerminalReplyStep(s));
        if (action.action === "skip" && next >= 0) {
            await createReplyReviewTask(tx, scope, plan, `step:${next}`, "Review the next reply follow-up", new Date(plan.steps[next]!.dueAt));
        }
        return null;
    });
    if (notify) await notifyReplyPlan(scope.teamId, notify, "Reply follow-up paused");
}
