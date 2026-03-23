import { z } from "zod";
import { EXECUTION_MODES, RUNTIME_TARGETS, TASK_VERSIONS } from "./executionModes";

export const TaskEnvelopeSchema = z.object({
    version: z.number().int().positive().default(TASK_VERSIONS.v1),
    task_type: z.string().min(1),
    tenant_id: z.string().min(1),
    execution_mode: z.enum(EXECUTION_MODES),
    target_runtime: z.enum(RUNTIME_TARGETS),
    task_id: z.string().min(1),
    idempotency_key: z.string().min(1),
    created_at: z.string().datetime(),
    expires_at: z.string().datetime().optional().nullable(),
    payload: z.record(z.string(), z.any()),
    policy: z.record(z.string(), z.any()).optional().nullable(),
    audit_context: z.record(z.string(), z.any()).optional().nullable(),
    correlation_id: z.string().optional().nullable()
}).strict();

export type TaskEnvelope = z.infer<typeof TaskEnvelopeSchema>;

export const LegacyJobSchema = z.object({
    type: z.string().min(1),
    payload: z.record(z.string(), z.any()),
    priority: z.number().int().optional(),
    teamId: z.string().optional().nullable(),
    idempotencyKey: z.string().optional()
}).strict();
