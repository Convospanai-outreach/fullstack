import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";
import { resolveExtensionTeamScope } from "../../_lib/teamScope";

const SUPPORTED_TASK_TYPES = [
    "OPEN_PROFILE",
    "ADD_LEAD",
    "INSERT_DRAFT",
    "LOG_MANUAL_LINKEDIN_ACTION"
];

const SUPPORTED_STATUSES = ["SUCCESS", "ERROR", "BLOCKED"];

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }

        const body = await req.json().catch(() => ({}));
        const requestedTeamId = sanitizeText(body.teamId, 120) || req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ ok: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }

        const taskId = sanitizeText(body.taskId, 120);
        const type = sanitizeText(body.type, 80) || "LOG_MANUAL_LINKEDIN_ACTION";
        const status = sanitizeText(body.status, 40) || "ERROR";
        const result = asRecord(body.result);
        const error = sanitizeText(body.error || result.error, 500);

        if (!SUPPORTED_TASK_TYPES.includes(type)) {
            return NextResponse.json({ ok: false, error: "Unsupported task type", code: "INVALID_TASK_TYPE" }, { status: 400 });
        }

        if (!SUPPORTED_STATUSES.includes(status)) {
            return NextResponse.json({ ok: false, error: "Unsupported task status", code: "INVALID_TASK_STATUS" }, { status: 400 });
        }

        await prisma.systemEvent.create({
            data: {
                teamId: teamScope.teamId,
                actorId: auth.user.id,
                type: "SYSTEM",
                name: "EXTENSION_TASK_RESULT",
                timestamp: new Date(),
                payload: {
                    taskId: taskId || null,
                    taskType: type,
                    status,
                    result,
                    error: error || null
                }
            }
        });

        if (!taskId) {
            return NextResponse.json({ ok: true, status: "recorded" });
        }

        const terminalStatus = status === "SUCCESS" ? "completed" : "failed";
        const update = await prisma.job.updateMany({
            where: {
                id: taskId,
                teamId: teamScope.teamId,
                status: { in: ["processing", "pending", "queued"] }
            },
            data: {
                status: terminalStatus,
                result: {
                    type,
                    status,
                    ...result
                },
                error: terminalStatus === "failed" ? error || "Extension task failed" : null,
                completedAt: new Date()
            }
        });

        if (update.count === 0) {
            const existing = await prisma.job.findFirst({
                where: { id: taskId, teamId: teamScope.teamId },
                select: { id: true, status: true }
            });

            if (!existing) {
                return NextResponse.json({ ok: false, error: "Task not found for current team", code: "TASK_NOT_FOUND" }, { status: 404 });
            }

            return NextResponse.json({ ok: true, taskId, status: existing.status });
        }

        return NextResponse.json({ ok: true, taskId, status: terminalStatus });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
