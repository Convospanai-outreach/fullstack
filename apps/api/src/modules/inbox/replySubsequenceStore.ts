import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const REPLY_PLAN_TYPE = "reply_subsequence_plan";
export const REPLY_PLAN_STATUS = "reply_subsequence_state";
const stepSchema = z.object({
    dueAt: z.number().int(),
    status: z.enum(["draft", "queued", "dispatching", "sent", "skipped", "blocked", "cancelled"]),
    reason: z.string().nullable(),
    revision: z.number().int().nonnegative(),
    draft: z.object({ v: z.number(), cipher: z.string(), iv: z.string(), tag: z.string() }).optional(),
    approvedBy: z.string().nullable(),
    sentAt: z.number().int().nullable(),
    firstAttemptAt: z.number().int().nullable(),
    holdSince: z.number().int().nullable(),
    holdUntil: z.number().int().nullable().default(null),
});
const planSchema = z.object({
    runId: z.string(),
    leadId: z.string(),
    campaignId: z.string(),
    mailboxId: z.string(),
    anchorId: z.string(),
    ownerId: z.string(),
    classification: z.string(),
    status: z.enum(["active", "paused", "decision", "completed", "cancelled"]),
    reason: z.string().nullable(),
    revision: z.number().int().nonnegative(),
    steps: z.array(stepSchema).min(1).max(4),
});

export type ReplyPlan = z.infer<typeof planSchema>;
export type ReplyStep = z.infer<typeof stepSchema>;
export type ReplyPlanScope = { teamId: string; leadId: string };
export type ReplyPlanTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Tx = ReplyPlanTx;

const planKey = ({ teamId, leadId }: ReplyPlanScope) => `reply_subsequence:${teamId}:${leadId}`;
export const replyStepKey = (scope: ReplyPlanScope, runId: string, index: number) => `${planKey(scope)}:${runId}:${index}`;

export function lockReplyPlan<T>(scope: ReplyPlanScope, work: (tx: Tx) => Promise<T>) {
    return prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(7402, hashtext(${planKey(scope)}))`;
        return work(tx);
    });
}

export class CorruptReplyPlanError extends Error {}

export async function readReplyPlan(scope: ReplyPlanScope, client: Pick<Tx, "job"> = prisma): Promise<ReplyPlan | null> {
    const row = await client.job.findUnique({
        where: { idempotencyKey: planKey(scope), teamId: scope.teamId, type: REPLY_PLAN_TYPE, status: REPLY_PLAN_STATUS },
        select: { payload: true },
    });
    if (!row) return null;
    const plan = decodeReplyPlan(row.payload);
    if (!plan) throw new CorruptReplyPlanError("The follow-up plan could not be read.");
    return plan;
}

export function decodeReplyPlan(payload: unknown) {
    const parsed = planSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
}

export async function getReplyDecisionLeads(teamId: string, leadIds: string[]) {
    if (!leadIds.length) return new Set<string>();
    const keys = [...new Set(leadIds)].map(leadId => planKey({ teamId, leadId }));
    const rows = await prisma.job.findMany({
        where: { teamId, type: REPLY_PLAN_TYPE, idempotencyKey: { in: keys }, payload: { path: ["status"], equals: "decision" } },
        select: { idempotencyKey: true },
    });
    const matching = new Set(rows.map(row => row.idempotencyKey));
    return new Set(leadIds.filter(leadId => matching.has(planKey({ teamId, leadId }))));
}

export async function saveReplyPlan(tx: Tx, scope: ReplyPlanScope, plan: ReplyPlan, event: {
    action: string; reason: string; actorId: string | null; step?: number;
}) {
    plan.revision += 1;
    const payload = plan as Prisma.InputJsonValue;
    await tx.job.upsert({
        where: { idempotencyKey: planKey(scope) },
        update: { payload, status: REPLY_PLAN_STATUS },
        create: { teamId: scope.teamId, type: REPLY_PLAN_TYPE, status: REPLY_PLAN_STATUS, payload, idempotencyKey: planKey(scope) },
    });
    await tx.auditLog.create({ data: {
        orgId: scope.teamId,
        actorId: event.actorId,
        entity: "ReplySubsequence",
        entityId: plan.runId,
        action: event.action,
        metadata: { reason: event.reason, step: event.step ?? null, revision: plan.revision },
    } });
}

export const replyReviewTaskId = (scope: ReplyPlanScope, runId: string, key: string) => `${replyStepKey(scope, runId, -1)}:${key}`;

export async function findReplyPlanOwner(client: Pick<Tx, "teamMember">, teamId: string, preferred: string | null) {
    const member = preferred ? await client.teamMember.findFirst({ where: { teamId, userId: preferred, status: "active" }, select: { userId: true } }) : null;
    if (member?.userId) return member.userId;
    const admin = await client.teamMember.findFirst({
        where: { teamId, status: "active", role: { in: ["owner", "admin"] } },
        orderBy: { id: "asc" }, select: { userId: true },
    });
    return admin?.userId ?? null;
}

export async function createReplyReviewTask(tx: Tx, scope: ReplyPlanScope, plan: ReplyPlan, key: string, title: string, dueAt: Date) {
    const ownerId = await findReplyPlanOwner(tx, scope.teamId, plan.ownerId);
    if (!ownerId) return;
    const id = replyReviewTaskId(scope, plan.runId, key);
    await tx.task.upsert({
        where: { id }, update: {},
        create: {
            id, teamId: scope.teamId, leadId: scope.leadId, userId: ownerId, title, priority: "HIGH", dueDate: dueAt,
            description: `Review this reply in the Inbox: /inbox?reply=${encodeURIComponent(plan.anchorId)}`,
        },
    });
}

export async function clearQueuedReplyStep(tx: Tx, scope: ReplyPlanScope, plan: ReplyPlan, index: number) {
    await tx.job.updateMany({
        where: {
            teamId: scope.teamId, type: "scheduled_inbox_reply",
            idempotencyKey: replyStepKey(scope, plan.runId, index),
            status: { in: ["queued", "pending", "running", "processing", "dead_lettered"] },
        },
        data: { status: "cancelled", completedAt: new Date(), payload: {}, result: { cancelledReplyId: plan.anchorId, step: index, runId: plan.runId }, version: { increment: 1 } },
    });
}

export async function takeOverUnreadablePlan(tx: Tx, scope: ReplyPlanScope, actorId: string) {
    await tx.job.updateMany({
        where: { teamId: scope.teamId, type: "scheduled_inbox_reply", idempotencyKey: { startsWith: planKey(scope) + ":" },
            status: { in: ["queued", "pending", "running", "processing"] } },
        data: { status: "cancelled", completedAt: new Date(), payload: {}, version: { increment: 1 } },
    });
    await tx.job.updateMany({
        where: { teamId: scope.teamId, idempotencyKey: planKey(scope), type: REPLY_PLAN_TYPE },
        data: { status: "reply_subsequence_retired" },
    });
    await tx.auditLog.create({ data: { orgId: scope.teamId, actorId, entity: "ReplySubsequence", entityId: scope.leadId,
        action: "cancelled", metadata: { reason: "unreadable_plan_takeover" } } });
}

export function isTerminalReplyStep(step: ReplyStep) {
    return step.status === "sent" || step.status === "skipped" || step.status === "cancelled";
}
