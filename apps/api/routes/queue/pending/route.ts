import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../extension/_lib/auth";
import { resolveExtensionTeamScope } from "../../extension/_lib/teamScope";

const CLAIM_TTL_MS = 5 * 60 * 1000;
const ALLOWED_ACTION_TYPES = new Set(["VISIT", "CONNECT", "MESSAGE", "INMAIL"]);
const LINKEDIN_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);

type TaskContext = Record<string, any>;

function asTaskContext(value: unknown): TaskContext {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as TaskContext) } : {};
}

function hasActiveClaim(context: TaskContext, nowMs: number) {
    const claim = context.extensionClaim;
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
        return false;
    }

    if (claim.completedAt) {
        return false;
    }

    const claimedAtMs = Date.parse(String(claim.claimedAt ?? ""));
    if (Number.isNaN(claimedAtMs)) {
        return false;
    }

    return nowMs - claimedAtMs < CLAIM_TTL_MS;
}

function normalizeActionType(actionType: unknown): string | null {
    if (typeof actionType !== "string") return null;
    const normalized = actionType.trim().toUpperCase();
    if (!ALLOWED_ACTION_TYPES.has(normalized)) return null;
    return normalized;
}

function normalizeLinkedInUrl(value: unknown): string | null {
    if (typeof value !== "string" || value.trim().length === 0) return null;
    try {
        const parsed = new URL(value.trim());
        const hostname = parsed.hostname.toLowerCase();
        if (!LINKEDIN_HOSTS.has(hostname)) return null;
        if (parsed.protocol !== "https:") return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function buildInvalidTaskContext(context: TaskContext, reason: string): TaskContext {
    return {
        ...context,
        extensionValidation: {
            status: "REJECTED",
            reason,
            rejectedAt: new Date().toISOString(),
            source: "EXTENSION_QUEUE_PENDING"
        }
    };
}

// GET /api/queue/pending
// Called by Chrome Extension to fetch next Approved task
export async function GET(req: NextRequest) {
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

        // Fetch oldest EXECUTING task meant for BROWSER
        // We use context filters which might be slow on large tables without index,
        // but for <100 operational tasks it's fine.
        const tasks = await prisma.agentTask.findMany({
            where: {
                teamId,
                status: "EXECUTING",
            },
            orderBy: { createdAt: "asc" },
            take: 100 // Fetch enough candidates so malformed rows don't starve valid work
        });

        // Filter for tasks demanding browser execution
        const nowMs = Date.now();

        for (const task of tasks) {
            const context = asTaskContext(task.context);
            const actionType = normalizeActionType(context.actionType);
            const targetUrl = normalizeLinkedInUrl(context.targetUrl);

            if (context.mode !== "BROWSER") {
                continue;
            }
            if (!actionType || !targetUrl) {
                const reason = !actionType ? "INVALID_ACTION_TYPE" : "INVALID_TARGET_URL";
                const invalidContext = buildInvalidTaskContext(context, reason);
                const failWhere: Record<string, any> = {
                    id: task.id,
                    teamId,
                    status: "EXECUTING"
                };
                if (task.updatedAt) {
                    failWhere.updatedAt = task.updatedAt;
                }
                const failed = await prisma.agentTask.updateMany({
                    where: failWhere,
                    data: {
                        status: "FAILED",
                        context: invalidContext
                    }
                });
                if (failed.count === 1) {
                    await prisma.agentLog.create({
                        data: {
                            taskId: task.id,
                            type: "ERROR",
                            content: `Browser task rejected: ${reason}`,
                            stepNumber: 0,
                            metadata: {
                                source: "EXTENSION",
                                reason,
                                rejectedAt: invalidContext.extensionValidation?.rejectedAt || new Date().toISOString()
                            }
                        }
                    });
                }
                continue;
            }

            if (hasActiveClaim(context, nowMs)) {
                continue;
            }

            const claimToken = randomUUID();
            const claimedAt = new Date().toISOString();
            const claimedContext = {
                ...context,
                extensionClaim: {
                    ...(typeof context.extensionClaim === "object" && context.extensionClaim ? context.extensionClaim : {}),
                    token: claimToken,
                    claimedAt,
                    claimedByUserId: auth.user?.id ?? null,
                    teamId: task.teamId,
                    source: "EXTENSION_QUEUE_PENDING"
                }
            };

            const claimWhere: Record<string, any> = {
                id: task.id,
                teamId,
                status: "EXECUTING"
            };

            if (task.updatedAt) {
                claimWhere.updatedAt = task.updatedAt;
            }

            const claimResult = await prisma.agentTask.updateMany({
                where: claimWhere,
                data: { context: claimedContext }
            });

            if (claimResult.count !== 1) {
                continue;
            }

            await prisma.agentLog.create({
                data: {
                    taskId: task.id,
                    type: "SYSTEM",
                    content: "Browser execution claimed by extension queue",
                    stepNumber: 0,
                    metadata: {
                        source: "EXTENSION",
                        claimToken,
                        claimedAt,
                        claimedByUserId: auth.user?.id ?? null
                    }
                }
            });

            const command = {
                id: task.id,
                type: actionType,
                target: targetUrl,
                details: context.draft || "No content",
                claimToken,
                metadata: {
                    ...context,
                    actionType,
                    targetUrl,
                    claimToken,
                    claimedAt
                }
            };

            return NextResponse.json({ command });
        }

        return NextResponse.json({ command: null });

    } catch (error: any) {
        console.error("[Queue API] Failed to fetch pending:", error);



        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
