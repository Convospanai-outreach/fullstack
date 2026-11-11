import { prisma } from "@/lib/db";
import { JobQueue, type JobPayload, type JobType } from "@/lib/queue";
import { SequenceService, type SequenceStep } from "@/lib/sequenceService";

// Web side of the per-message approval gate (the API worker holds the message as a MESSAGE_SEND
// approval; see apps/api/src/modules/governance/messageApproval.ts). Approving re-queues the
// original job with the approved text, once.

export const MESSAGE_ACTION_TYPE = "MESSAGE_SEND";

type Held = { jobType: JobType; jobPayload: JobPayload; channel: string; subject?: string; body: string };

function readHeld(payload: unknown): Held | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Partial<Held>;
    if (typeof p.jobType !== "string" || typeof p.body !== "string" || !p.jobPayload || !p.channel) return null;
    return p as Held;
}

export type MessageEdit = { subject?: string; body?: string };

export async function approveMessageSend(
    request: { id: string; status: string; payload: unknown },
    teamId: string,
    reviewerId: string,
    edit?: MessageEdit,
) {
    if (request.status === "EXECUTING" || request.status === "SENT") return;

    const held = readHeld(request.payload);
    if (!held) throw new Error("This message approval has no message to send.");

    if (request.status === "PENDING") {
        // The reviewer's edit replaces the stored text in the same step that approves it.
        const body = edit?.body?.trim();
        const subject = edit?.subject?.trim();
        if (edit?.body !== undefined && !body) throw new Error("The message cannot be empty.");
        const payload = {
            ...held,
            ...(body ? { body } : {}),
            ...(subject ? { subject } : {}),
        };
        const decided = await prisma.approvalRequest.updateMany({
            where: { id: request.id, teamId, status: "PENDING", autoDenyAt: { gt: new Date() } },
            data: { status: "APPROVED", reviewerId, reviewedAt: new Date(), payload: payload as any },
        });
        if (decided.count === 0) throw new Error("This message approval has expired or was already decided.");
    } else if (request.status !== "APPROVED") {
        throw new Error(`This message approval is already ${request.status.toLowerCase().replaceAll("_", " ")}.`);
    }

    await JobQueue.enqueue(held.jobType, { ...held.jobPayload, approvedMessageId: request.id }, {
        teamId,
        idempotencyKey: `approved_message_${request.id}`,
    });
}

// Only a message still waiting can be rejected.
export async function rejectMessageSend(requestId: string, teamId: string, reviewerId: string, reason?: string) {
    const rejected = await prisma.approvalRequest.updateMany({
        where: { id: requestId, teamId, status: "PENDING" },
        data: { status: "REJECTED", reviewerId, reviewedAt: new Date(), reviewNote: reason || "Rejected by reviewer" },
    });
    return rejected.count > 0;
}

export type AttentionAction = "RETRY" | "WRITE" | "SKIP";

// A NEEDS_ATTENTION row from a failed generation keeps the job that was writing the message (and
// no body). One whose approved text failed to send has a body and is left to Skip: re-running it
// could send twice.
function readFailedJob(payload: unknown): Pick<Held, "jobType" | "jobPayload" | "channel"> | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Partial<Held>;
    if (typeof p.body === "string") return null;
    if (typeof p.jobType !== "string" || typeof p.channel !== "string" || typeof p.jobPayload !== "object" || p.jobPayload === null) return null;
    return { jobType: p.jobType, jobPayload: p.jobPayload, channel: p.channel };
}

export function canRetryMessage(payload: unknown) {
    return readFailedJob(payload) !== null;
}

// Retry runs the job again from scratch (a fresh draft goes through the gate). Write manually sends
// the reviewer's own text as an approved message. Skip closes the row and moves a LinkedIn
// sequence on to its next step. Each claims the row first, so a second click does nothing.
export async function resolveNeedsAttention(
    request: { id: string; status: string; payload: unknown },
    teamId: string,
    reviewerId: string,
    action: AttentionAction,
    edit?: MessageEdit,
) {
    if (request.status !== "NEEDS_ATTENTION") throw new Error("This message no longer needs attention.");
    const job = readFailedJob(request.payload);
    if (action !== "SKIP" && !job) throw new Error("This message cannot be retried or written here. Skip it instead.");

    let status = "SKIPPED";
    let payload = request.payload;
    if (action === "RETRY") status = "RETRIED";
    if (action === "WRITE" && job) {
        status = "APPROVED";
        const body = edit?.body?.trim();
        const subject = edit?.subject?.trim();
        if (!body) throw new Error("Write the message before sending it.");
        if (job.channel === "EMAIL" && !subject) throw new Error("An email needs a subject.");
        payload = { ...(request.payload as object), body, ...(subject ? { subject } : {}) };
    }

    const claimed = await prisma.approvalRequest.updateMany({
        where: { id: request.id, teamId, status: "NEEDS_ATTENTION" },
        data: { status, reviewerId, reviewedAt: new Date(), payload: payload as any },
    });
    if (claimed.count === 0) throw new Error("This message was already handled.");

    try {
        if (action === "RETRY" && job) {
            await JobQueue.enqueue(job.jobType, job.jobPayload, { teamId, idempotencyKey: `retry_message_${request.id}` });
        } else if (action === "WRITE" && job) {
            await JobQueue.enqueue(job.jobType, { ...job.jobPayload, approvedMessageId: request.id }, {
                teamId,
                idempotencyKey: `approved_message_${request.id}`,
            });
        } else if (job?.jobType === "SEQUENCE_ACTION") {
            const { leadId, url, action: step, variantId } = job.jobPayload as Record<string, unknown>;
            if (typeof leadId === "string" && typeof step === "string") {
                await SequenceService.scheduleNextStep(
                    leadId,
                    typeof url === "string" ? url : "",
                    step as SequenceStep,
                    teamId,
                    typeof variantId === "string" ? variantId : undefined,
                );
            }
        }
    } catch (error) {
        // Nothing was queued, so put the row back for another try.
        await prisma.approvalRequest.updateMany({
            where: { id: request.id, teamId, status },
            data: { status: "NEEDS_ATTENTION", payload: request.payload as any },
        });
        throw error;
    }
}
