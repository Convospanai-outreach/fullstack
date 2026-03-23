import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { TaskEnvelopeSchema, LegacyJobSchema } from "@/contracts/taskEnvelope";

// GET /api/jobs - List all jobs
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || undefined;
        const status = searchParams.get("status") || undefined;
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        // const result = await JobQueue.dequeue(); 
        // Actually, JobQueue doesn't have a generic list method yet. Let's use Prisma directly in the route if needed or add it.
        // For now, let's keep it simple and use Prisma since it's just a GET route.
        const jobs = await prisma.job.findMany({
            where: {
                ...(type && { type }),
                ...(status && { status })
            },
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" }
        });
        const result = jobs;

        return NextResponse.json(result);
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
        const body = await req.json();
        const unsafeTypes = new Set([
            "email_sending",
            "email_send",
            "LINKEDIN_ACTION",
            "SEQUENCE_ACTION",
            "WEBHOOK_DISPATCH"
        ]);

        let job;

        if (body && typeof body === "object" && "version" in body) {
            const envelope = TaskEnvelopeSchema.parse(body);
            job = await JobQueue.enqueue(envelope.task_type as any, envelope.payload, {
                priority: body.priority ?? 0,
                teamId: envelope.tenant_id,
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
            job = await JobQueue.enqueue(legacy.type as any, legacy.payload, {
                priority: legacy.priority ?? 0,
                teamId: legacy.teamId ?? null,
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
