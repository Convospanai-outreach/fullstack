import { JobPayload } from "@/lib/queue";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";

function asString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asLimit(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function handleSequenceExecution(payload: JobPayload) {
    const runId = asString(payload.runId);
    if (runId) {
        return SequenceService.executeRun({ runId });
    }

    return SequenceService.processDue({
        teamId: asString(payload.teamId),
        limit: asLimit(payload.limit),
    });
}
