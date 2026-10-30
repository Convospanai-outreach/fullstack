import { prisma } from "@/lib/db";
import { JobQueue, type JobPayload, type JobType } from "@/lib/queue";

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
