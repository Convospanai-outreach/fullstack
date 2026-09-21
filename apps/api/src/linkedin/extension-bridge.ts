import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Task types the browser extension executes (opens a profile tab, inserts a
// draft for the user to review, captures a lead, logs a manual action). These
// are consumed by the extension via GET /extension/tasks/pending, NOT by the
// server job processor - it has no handler for them and would fail them.
export const EXTENSION_TASK_TYPES = [
    "OPEN_PROFILE",
    "ADD_LEAD",
    "INSERT_DRAFT",
    "LOG_MANUAL_LINKEDIN_ACTION"
] as const;

export type ExtensionTaskType = (typeof EXTENSION_TASK_TYPES)[number];

// Dedicated Job.status lane for extension-executed tasks. The server job
// processor only dequeues "queued"/"pending" (DEQUEUEABLE_JOB_STATUSES in
// queue.ts), so parking these here stops it from claiming a task it can't run
// and failing it out from under the extension. Lifecycle: created here ->
// claimed by GET /extension/tasks/pending ("processing") -> closed by
// POST /extension/tasks/result ("completed"/"failed").
export const EXTENSION_TASK_STATUS = "awaiting_extension";

/**
 * Creates a task the browser extension will pick up on its next poll. Uses a
 * direct create (not JobQueue.enqueue, which parks jobs in the server-dequeueable
 * "queued" status) so the task stays in the extension-only status lane. A
 * deterministic idempotencyKey lets a retried producer (e.g. a re-run sequence
 * step) reuse the existing task instead of duplicating it.
 */
export async function enqueueExtensionTask(params: {
    teamId: string;
    type: ExtensionTaskType;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    priority?: number;
}): Promise<{ id: string; created: boolean }> {
    try {
        const job = await prisma.job.create({
            data: {
                type: params.type,
                taskType: params.type,
                status: EXTENSION_TASK_STATUS,
                teamId: params.teamId,
                tenantId: params.teamId,
                payload: params.payload as any,
                priority: params.priority ?? 0,
                idempotencyKey: params.idempotencyKey ?? null
            }
        });
        return { id: job.id, created: true };
    } catch (error: any) {
        if (error?.code === "P2002" && params.idempotencyKey) {
            const existing = await prisma.job.findUnique({
                where: { idempotencyKey: params.idempotencyKey },
                select: { id: true }
            });
            if (existing) return { id: existing.id, created: false };
        }
        throw error;
    }
}

export type ExtensionAction =
    | "ADD_LEAD"
    | "OPEN_PROFILE"
    | "INSERT_DRAFT"
    | "LINKEDIN_TASK"
    | "WHATSAPP_TASK"
    | "CALL_TASK";

export type StopReason =
    | "VERIFICATION_REQUIRED"
    | "WARNING_DETECTED"
    | "CHECKPOINT_DETECTED"
    | "MANUAL_STOP";

export interface ExtensionPayload {
    action: ExtensionAction;
    status: string;
    leadId?: string;
    profileUrl?: string;
    stopReason?: StopReason | null;
    durationMs?: number;
    taskId?: string;
    teamId: string;
    userId: string;
}

const VALID_ACTIONS: ExtensionAction[] = [
    "ADD_LEAD",
    "OPEN_PROFILE",
    "INSERT_DRAFT",
    "LINKEDIN_TASK",
    "WHATSAPP_TASK",
    "CALL_TASK"
];

const VALID_STOP_REASONS: StopReason[] = [
    "VERIFICATION_REQUIRED",
    "WARNING_DETECTED",
    "CHECKPOINT_DETECTED",
    "MANUAL_STOP"
];

export async function receiveExtensionPayload(payload: ExtensionPayload) {
    if (!VALID_ACTIONS.includes(payload.action)) {
        throw new Error(`Invalid action type: ${payload.action}`);
    }

    if (payload.stopReason && !VALID_STOP_REASONS.includes(payload.stopReason)) {
        throw new Error(`Invalid stop reason: ${payload.stopReason}`);
    }

    try {
        await prisma.systemEvent.create({
            data: {
                teamId: payload.teamId,
                actorId: payload.userId,
                type: "SYSTEM",
                name: "EXTENSION_ACTION_RESULT",
                timestamp: new Date(),
                payload: {
                    action: payload.action,
                    status: payload.status,
                    leadId: payload.leadId,
                    profileUrl: payload.profileUrl,
                    stopReason: payload.stopReason,
                    durationMs: payload.durationMs,
                    taskId: payload.taskId
                }
            }
        });

        if (payload.taskId) {
            const isFailed = payload.status === "ERROR" || payload.status === "BLOCKED";
            await prisma.job.updateMany({
                where: { id: payload.taskId, teamId: payload.teamId },
                data: {
                    status: isFailed ? "failed" : "completed",
                    error: isFailed ? (payload.stopReason || "Execution failed") : null,
                    completedAt: new Date(),
                    result: payload as any
                }
            });
        }

        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("Failed to log extension payload to system_events", error);
        return { ok: false, error: message };
    }
}
