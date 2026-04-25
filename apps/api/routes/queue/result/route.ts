import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../extension/_lib/auth";

type TaskContext = Record<string, any>;

function asTaskContext(value: unknown): TaskContext {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as TaskContext) } : {};
}

function isTerminalStatus(status: string) {
    return status === "COMPLETED" || status === "FAILED";
}

function toComparableValue(value: unknown) {
    return JSON.stringify(value ?? null);
}

function isIdempotentResult(task: { status: string; context: unknown }, status: string, details: unknown, durationMs: number, claimToken?: string) {
    const context = asTaskContext(task.context);
    const existingStatus = String(context.executionStatus ?? (task.status === "COMPLETED" ? "SUCCESS" : task.status === "FAILED" ? "FAILED" : ""));
    const existingDuration = Number(context.durationMs ?? 0);
    const existingClaimToken = context.extensionClaim?.token;

    return existingStatus === status
        && toComparableValue(context.executionResult) === toComparableValue(details)
        && existingDuration === durationMs
        && (!claimToken || !existingClaimToken || existingClaimToken === claimToken);
}

function buildResultConflictResponse(task: { status: string; context: unknown }, status: string, details: unknown, durationMs: number, claimToken?: string) {
    if (isTerminalStatus(task.status) && isIdempotentResult(task, status, details, durationMs, claimToken)) {
        return NextResponse.json({ success: true, idempotent: true, duplicate: true }, { status: 200 });
    }

    if (!isTerminalStatus(task.status)) {
        return NextResponse.json(
            { error: "Task is not awaiting a browser result", code: "TASK_NOT_EXECUTING" },
            { status: 409 }
        );
    }

    return NextResponse.json(
        { error: "Task already has a different recorded result", code: "RESULT_CONFLICT" },
        { status: 409 }
    );
}

// POST /api/queue/result
// Called by Chrome Extension to report success/failure
export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }

        if (auth.teamIds.length === 0) {
            return NextResponse.json(
                { ok: false, error: "User has no team membership", code: "NO_TEAM_MEMBERSHIP" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { commandId, status, details, duration, claimToken } = body;

        if (!commandId || !status) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        // 1. Update Task Status
        const taskStatus = status === "SUCCESS" ? "COMPLETED" : "FAILED";

        // Fetch current context to merge
        const currentTask = await prisma.agentTask.findFirst({
            where: {
                id: commandId,
                teamId: { in: auth.teamIds }
            }
        });
        if (!currentTask) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const currentContext = asTaskContext(currentTask.context);
        const normalizedDuration = Number(duration || 0);
        const currentClaimToken = currentContext.extensionClaim?.token;

        if (claimToken && currentClaimToken && claimToken !== currentClaimToken) {
            return NextResponse.json(
                { error: "Claim token does not match the active browser claim", code: "CLAIM_MISMATCH" },
                { status: 409 }
            );
        }

        if (currentTask.status !== "EXECUTING") {
            return buildResultConflictResponse(currentTask, status, details, normalizedDuration, claimToken);
        }

        const executedAt = new Date().toISOString();
        const newContext = {
            ...currentContext,
            executionStatus: status,
            executionResult: details,
            durationMs: normalizedDuration,
            executedAt,
            extensionClaim: currentContext.extensionClaim
                ? {
                    ...currentContext.extensionClaim,
                    completedAt: executedAt,
                    completedStatus: status
                }
                : undefined
        };

        const updateWhere: Record<string, any> = {
            id: currentTask.id,
            teamId: { in: auth.teamIds },
            status: "EXECUTING"
        };

        if (currentTask.updatedAt) {
            updateWhere.updatedAt = currentTask.updatedAt;
        }

        const updateResult = await prisma.agentTask.updateMany({
            where: updateWhere,
            data: {
                status: taskStatus,
                context: newContext
            }
        });

        if (updateResult.count !== 1) {
            const latestTask = await prisma.agentTask.findFirst({
                where: {
                    id: commandId,
                    teamId: { in: auth.teamIds }
                }
            });

            if (!latestTask) {
                return NextResponse.json({ error: "Task not found" }, { status: 404 });
            }

            return buildResultConflictResponse(latestTask, status, details, normalizedDuration, claimToken);
        }

        // 2. Add specific Log entry
        await prisma.agentLog.create({
            data: {
                taskId: commandId,
                type: "ACTION",
                content: `Browser Execution ${status}: ${details}`,
                stepNumber: 0,
                metadata: { duration: normalizedDuration, source: "EXTENSION", claimToken: claimToken ?? currentClaimToken ?? null }
            }
        });

        return NextResponse.json({ success: true, id: commandId });

    } catch (error: any) {
        console.error("[Queue API] Failed to report result:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
