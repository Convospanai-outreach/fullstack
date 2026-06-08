import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

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
