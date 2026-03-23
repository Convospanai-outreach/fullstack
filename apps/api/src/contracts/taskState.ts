export const TASK_STATES = [
    "queued",
    "dispatched",
    "received",
    "running",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
    "dead_lettered"
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const TRANSITIONS: Record<TaskState, TaskState[]> = {
    queued: ["dispatched", "cancelled", "dead_lettered"],
    dispatched: ["received", "timed_out", "dead_lettered"],
    received: ["running", "failed", "dead_lettered"],
    running: ["succeeded", "failed", "cancelled", "timed_out", "dead_lettered"],
    succeeded: [],
    failed: [],
    cancelled: [],
    timed_out: [],
    dead_lettered: []
};

export function canTransition(from: TaskState, to: TaskState): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
}
