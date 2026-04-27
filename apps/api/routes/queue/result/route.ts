import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../extension/_lib/auth";
import { PIIScrubber } from "@/lib/governance/PIIScrubber";
import { resolveExtensionTeamScope } from "../../extension/_lib/teamScope";

type TaskContext = Record<string, any>;
const ALLOWED_RESULT_STATUS = new Set(["SUCCESS", "FAILED", "BLOCKED", "SKIPPED"]);
const MAX_DETAIL_STRING_LENGTH = 500;

function asTaskContext(value: unknown): TaskContext {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as TaskContext) } : {};
}

function isTerminalStatus(status: string) {
    return status === "COMPLETED" || status === "FAILED";
}

function toComparableValue(value: unknown) {
    return JSON.stringify(value ?? null);
}

function sanitizeDetailString(value: string): string {
    return PIIScrubber.scrub(value.trim()).slice(0, MAX_DETAIL_STRING_LENGTH);
}

function sanitizeResultDetails(value: unknown): unknown {
    if (typeof value === "string") {
        return sanitizeDetailString(value);
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeResultDetails);
    }
    if (value && typeof value === "object") {
        const output: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            output[key] = sanitizeResultDetails(nested);
        }
        return output;
    }
    return value;
}

function extractStopReason(status: string, details: unknown): string | null {
    if (status !== "BLOCKED") return null;
    if (details && typeof details === "object" && !Array.isArray(details)) {
        const raw = (details as Record<string, unknown>).stopReason;
        if (typeof raw === "string" && raw.trim().length > 0) {
            return sanitizeDetailString(raw);
        }
    }
    return "BLOCKED";
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
        const teamScope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
        if (!teamScope.ok) {
            return NextResponse.json(
                { ok: false, error: teamScope.error, code: teamScope.code },
                { status: teamScope.status }
            );
        }
        const teamId = teamScope.teamId;

        const body = await req.json();
        const { commandId, status, details, duration, claimToken } = body;

        if (!commandId || !status) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }
        if (typeof claimToken !== "string" || claimToken.trim().length === 0) {
            return NextResponse.json(
                { error: "claimToken is required", code: "CLAIM_TOKEN_REQUIRED" },
                { status: 400 }
            );
        }

        const normalizedStatus = String(status).trim().toUpperCase();
        if (!ALLOWED_RESULT_STATUS.has(normalizedStatus)) {
            return NextResponse.json(
                { error: "Invalid status", code: "INVALID_STATUS" },
                { status: 400 }
            );
        }
        const parsedDuration = Number(duration);
        const normalizedDuration = Number.isFinite(parsedDuration) && parsedDuration >= 0
            ? Math.floor(parsedDuration)
            : 0;
        const sanitizedDetails = sanitizeResultDetails(details);
        const stopReason = extractStopReason(normalizedStatus, details);

        // 1. Update Task Status
        const taskStatus = normalizedStatus === "SUCCESS" || normalizedStatus === "SKIPPED" ? "COMPLETED" : "FAILED";

        // Fetch current context to merge
        const currentTask = await prisma.agentTask.findFirst({
            where: {
                id: commandId,
                teamId
            }
        });
        if (!currentTask) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const currentContext = asTaskContext(currentTask.context);
        const currentClaimToken = currentContext.extensionClaim?.token;

        if (!currentClaimToken) {
            return NextResponse.json(
                { error: "Task has no active claim token", code: "TASK_NOT_CLAIMED" },
                { status: 409 }
            );
        }

        if (claimToken !== currentClaimToken) {
            return NextResponse.json(
                { error: "Claim token does not match the active browser claim", code: "CLAIM_MISMATCH" },
                { status: 409 }
            );
        }

        if (currentTask.status !== "EXECUTING") {
            return buildResultConflictResponse(currentTask, normalizedStatus, sanitizedDetails, normalizedDuration, claimToken);
        }

        const executedAt = new Date().toISOString();
        const newContext = {
            ...currentContext,
            executionStatus: normalizedStatus,
            executionResult: sanitizedDetails,
            executionDisposition: {
                outcome: normalizedStatus,
                taskStatus,
                stopReason
            },
            durationMs: normalizedDuration,
            executedAt,
            extensionClaim: currentContext.extensionClaim
                ? {
                    ...currentContext.extensionClaim,
                    completedAt: executedAt,
                    completedStatus: normalizedStatus
                }
                : undefined
        };

        const updateWhere: Record<string, any> = {
            id: currentTask.id,
            teamId,
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
                    teamId
                }
            });

            if (!latestTask) {
                return NextResponse.json({ error: "Task not found" }, { status: 404 });
            }

            return buildResultConflictResponse(latestTask, normalizedStatus, sanitizedDetails, normalizedDuration, claimToken);
        }

        // 2. Add specific Log entry
        await prisma.agentLog.create({
            data: {
                taskId: commandId,
                type: "ACTION",
                content: `Browser Execution ${normalizedStatus}`,
                stepNumber: 0,
                metadata: {
                    duration: normalizedDuration,
                    source: "EXTENSION",
                    claimToken: claimToken,
                    outcome: normalizedStatus,
                    ...(stopReason ? { stopReason } : {}),
                    resultPreview: sanitizedDetails
                }
            }
        });

        return NextResponse.json({ success: true, id: commandId });

    } catch (error: any) {
        console.error("[Queue API] Failed to report result:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
