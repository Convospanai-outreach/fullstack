import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { TaskEnvelopeSchema, LegacyJobSchema } from "@/contracts/taskEnvelope";
import { getCurrentContext } from "@/lib/auth";

// GET /api/jobs - List all jobs for current tenant
export async function GET(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || undefined;
        const status = searchParams.get("status") || undefined;
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
        const offset = parseInt(searchParams.get("offset") || "0");

        const jobs = await prisma.job.findMany({
            where: {
                teamId: ctx.teamId,
                ...(type && { type }),
                ...(status && { status })
            },
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(jobs);
    } catch (error) {
        console.error("Error fetching jobs:", error);
        return NextResponse.json(
            { error: "Failed to fetch jobs" },
            { status: 500 }
        );
    }
}

// POST /api/jobs - Create new job
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const unsafeTypes = new Set([
            "email_sending",
            "email_send",
            "LINKEDIN_ACTION",
            "SEQUENCE_ACTION",
            "WEBHOOK_DISPATCH"
        ]);
        // Job types with no legitimate direct-client trigger: their sole
        // producer is another worker/service, and their payload carries no
        // teamId to scope against (e.g. warmup_seed_reply sends through a
        // shared, non-tenant-owned WarmupSeedMailbox with a caller-controlled
        // toEmail/subject - see OPEN-188). Reject them here rather than in
        // the handler, since by the time job-processor.ts runs there's no
        // caller identity left to check against. workflow_step is the same
        // shape: WorkflowService.processNode(runId, nodeId) resolves the run
        // purely by id with no team check of its own, so a client-submitted
        // job referencing another team's runId can hijack their workflow -
        // triggering real email sends or skipping delay/condition nodes -
        // see OPEN-194. Its only legitimate producers (WorkflowService's own
        // scheduler, OutboxService) never go through this route.
        const clientBlockedTypes = new Set(["warmup_seed_reply", "workflow_step"]);

        let job;

        if (body && typeof body === "object" && "version" in body) {
            const envelope = TaskEnvelopeSchema.parse(body);
            if (clientBlockedTypes.has(envelope.task_type)) {
                return NextResponse.json({ error: "Job type cannot be enqueued directly" }, { status: 403 });
            }
            // payload.teamId is read by worker handlers as the authoritative
            // tenant for ownership checks (e.g. email-worker.ts,
            // enrichment-worker.ts) - never let the caller set it to a
            // different team than their own session, or those checks become
            // trivially bypassable.
            const scopedPayload = { ...envelope.payload, teamId: ctx.teamId };
            job = await JobQueue.enqueue(envelope.task_type as any, scopedPayload, {
                priority: body.priority ?? 0,
                teamId: ctx.teamId,
                idempotencyKey: envelope.idempotency_key,
                requireIdempotency: unsafeTypes.has(envelope.task_type),
                version: envelope.version,
                executionMode: envelope.execution_mode,
                targetRuntime: envelope.target_runtime,
                taskId: envelope.task_id,
                expiresAt: envelope.expires_at ? new Date(envelope.expires_at) : null,
                policy: envelope.policy ?? null,
                auditContext: envelope.audit_context ?? null,
                correlationId: envelope.correlation_id ?? null
            });
        } else {
            const legacy = LegacyJobSchema.parse(body);
            if (clientBlockedTypes.has(legacy.type)) {
                return NextResponse.json({ error: "Job type cannot be enqueued directly" }, { status: 403 });
            }
            const scopedPayload = { ...legacy.payload, teamId: ctx.teamId };
            job = await JobQueue.enqueue(legacy.type as any, scopedPayload, {
                priority: legacy.priority ?? 0,
                teamId: ctx.teamId,
                idempotencyKey: legacy.idempotencyKey,
                requireIdempotency: unsafeTypes.has(legacy.type)
            });
        }

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        console.error("Error creating job:", error);
        return NextResponse.json(
            { error: "Failed to create job" },
            { status: 500 }
        );
    }
}
