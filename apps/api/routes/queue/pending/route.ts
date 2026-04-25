import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../extension/_lib/auth";

const CLAIM_TTL_MS = 5 * 60 * 1000;

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

        // Fetch oldest EXECUTING task meant for BROWSER
        // We use context filters which might be slow on large tables without index,
        // but for <100 operational tasks it's fine.
        const tasks = await prisma.agentTask.findMany({
            where: {
                teamId: { in: auth.teamIds },
                status: "EXECUTING",
            },
            orderBy: { createdAt: "asc" },
            take: 10 // Fetch a batch to filter in memory if needed
        });

        // Filter for tasks demanding browser execution
        const nowMs = Date.now();

        for (const task of tasks) {
            const context = asTaskContext(task.context);

            if (context.mode !== "BROWSER") {
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
                teamId: { in: auth.teamIds },
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
                type: context.actionType || "CONNECT",
                target: context.targetUrl || "https://linkedin.com",
                details: context.draft || "No content",
                claimToken,
                metadata: {
                    ...context,
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
