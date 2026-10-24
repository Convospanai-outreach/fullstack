import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { TaskEnvelopeSchema, LegacyJobSchema } from "@/contracts/taskEnvelope";
import { getCurrentContext } from "@/lib/auth";
import { TeamRole, forbiddenUnlessRole } from "@/lib/permissions";

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

// The only job types a client may enqueue here directly. Every other type has its own producer
// (a dedicated route, the scheduler or a worker) that runs the checks the job relies on first:
// credits, campaign approval and limits, ownership of the ids in the payload. lead_scoring
// rescores the caller's own team only (its handler reads payload.teamId, forced below).
const CLIENT_ENQUEUEABLE_TYPES = new Set(["lead_scoring"]);

function cannotEnqueue() {
    return NextResponse.json({ error: "Job type cannot be enqueued directly" }, { status: 403 });
}

// POST /api/jobs - Create new job
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const denied = await forbiddenUnlessRole(ctx.userId, ctx.teamId, TeamRole.MEMBER);
        if (denied) return denied;

        const body = await req.json();

        let job;

        if (body && typeof body === "object" && "version" in body) {
            const envelope = TaskEnvelopeSchema.parse(body);
            if (!CLIENT_ENQUEUEABLE_TYPES.has(envelope.task_type)) return cannotEnqueue();
            // payload.teamId is read by worker handlers as the authoritative
            // tenant for ownership checks - never let the caller set it to a
            // different team than their own session.
            const scopedPayload = { ...envelope.payload, teamId: ctx.teamId };
            job = await JobQueue.enqueue(envelope.task_type as any, scopedPayload, {
                priority: body.priority ?? 0,
                teamId: ctx.teamId,
                idempotencyKey: envelope.idempotency_key,
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
            if (!CLIENT_ENQUEUEABLE_TYPES.has(legacy.type)) return cannotEnqueue();
            const scopedPayload = { ...legacy.payload, teamId: ctx.teamId };
            job = await JobQueue.enqueue(legacy.type as any, scopedPayload, {
                priority: legacy.priority ?? 0,
                teamId: ctx.teamId,
                idempotencyKey: legacy.idempotencyKey
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
