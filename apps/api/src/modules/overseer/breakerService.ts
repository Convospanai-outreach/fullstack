import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type BreakerStateValue = "CLOSED" | "OPEN" | "HALF_OPEN";

// Starting points from OVERSEER_ARCHITECTURE_PLAN.md §04/§09, explicitly not measured
// defaults - revisit once real queue-depth/TAT/deny-rate data exists.
const TRIP_DEPTH = parseInt(process.env["BREAKER_TRIP_DEPTH"] || "50");
const TRIP_TAT_P90_HOURS = parseFloat(process.env["BREAKER_TRIP_TAT_P90_HOURS"] || "12");
const TRIP_DENY_RATE = parseFloat(process.env["BREAKER_TRIP_DENY_RATE"] || "0.40");
const RESET_DEPTH = parseInt(process.env["BREAKER_RESET_DEPTH"] || "20");
const RESET_DENY_RATE = parseFloat(process.env["BREAKER_RESET_DENY_RATE"] || "0.15");
const RESET_HOLD_MS = 30 * 60 * 1000; // 30 minutes, per plan §04
const METRICS_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h rolling window, per plan §04

export const EXTENDED_TIMEOUT_HOURS = 72; // vs. the normal 24h QUEUED timeout, while OPEN/HALF_OPEN

type TeamMetrics = { depth: number; tatP90Hours: number; denyRate: number; resolvedCount: number };

function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[idx];
}

async function computeTeamMetrics(teamId: string, windowStart: Date): Promise<TeamMetrics> {
    const [depth, resolved] = await Promise.all([
        prisma.approvalRequest.count({
            where: { teamId, tier: "QUEUED", status: "PENDING" }
        }),
        prisma.approvalRequest.findMany({
            where: {
                teamId,
                tier: "QUEUED",
                status: { in: ["APPROVED", "REJECTED"] },
                reviewedAt: { gte: windowStart }
            },
            select: { createdAt: true, reviewedAt: true, reviewerId: true }
        })
    ]);

    const tatHours = resolved
        .filter((r) => r.reviewedAt)
        .map((r) => (r.reviewedAt!.getTime() - r.createdAt.getTime()) / (60 * 60 * 1000));
    const timeoutDenials = resolved.filter((r) => r.reviewerId === "system-timeout").length;

    return {
        depth,
        tatP90Hours: percentile(tatHours, 0.9),
        denyRate: resolved.length > 0 ? timeoutDenials / resolved.length : 0,
        resolvedCount: resolved.length
    };
}

function isTripCondition(metrics: TeamMetrics): boolean {
    return metrics.depth > TRIP_DEPTH || metrics.tatP90Hours > TRIP_TAT_P90_HOURS || metrics.denyRate > TRIP_DENY_RATE;
}

function isResetCondition(metrics: TeamMetrics): boolean {
    return metrics.depth < RESET_DEPTH && metrics.denyRate < RESET_DENY_RATE;
}

async function alertQueueOwner(teamId: string, metrics: TeamMetrics): Promise<void> {
    logger.error("[CircuitBreaker] Tripped OPEN for team", { teamId, ...metrics });
    try {
        const owner = await prisma.teamMember.findFirst({
            where: {
                teamId,
                userId: { not: null },
                OR: [{ role: "OWNER" }, { role: "ADMIN" }, { role: "owner" }, { role: "admin" }]
            },
            select: { userId: true }
        });
        const fallback = owner?.userId
            ? null
            : await prisma.teamMember.findFirst({
                  where: { teamId, userId: { not: null } },
                  orderBy: { createdAt: "asc" },
                  select: { userId: true }
              });
        const targetUserId = owner?.userId || fallback?.userId;
        if (targetUserId) {
            await prisma.notification.create({
                data: {
                    userId: targetUserId,
                    type: "OVERSEER_BREAKER_TRIPPED",
                    message: `Your approval queue crossed a safety threshold (depth ${metrics.depth}, TAT p90 ${metrics.tatP90Hours.toFixed(1)}h, deny rate ${(metrics.denyRate * 100).toFixed(0)}%). Queued-approval timeouts are extended to ${EXTENDED_TIMEOUT_HOURS}h and new stall nudges are paused until it recovers.`,
                    meta: metrics as any
                }
            });
        }
    } catch (err) {
        logger.error("[CircuitBreaker] Failed to notify queue owner", { teamId, error: (err as Error).message });
    }
}

/**
 * Overseer circuit breaker (OVERSEER_ARCHITECTURE_PLAN.md §04). Evaluated per team on
 * every Overseer tick. Only ever alerts, extends timeouts, and throttles nudges - never
 * approves, unblocks, or bypasses a tier. HARD_BLOCK requests are never touched here.
 */
export async function evaluateBreakers(): Promise<{ teamsEvaluated: number; tripped: number }> {
    const windowStart = new Date(Date.now() - METRICS_WINDOW_MS);

    const activeTeams = await prisma.approvalRequest.findMany({
        where: {
            tier: "QUEUED",
            OR: [{ status: "PENDING" }, { reviewedAt: { gte: windowStart } }]
        },
        distinct: ["teamId"],
        select: { teamId: true }
    });

    let tripped = 0;

    for (const { teamId } of activeTeams) {
        const metrics = await computeTeamMetrics(teamId, windowStart);
        const existing = await prisma.breakerState.findUnique({ where: { teamId } });
        const previousState: BreakerStateValue = (existing?.state as BreakerStateValue) || "CLOSED";

        let nextState: BreakerStateValue = previousState;
        let trippedAt = existing?.trippedAt ?? null;
        let resetConditionsMetSince = existing?.resetConditionsMetSince ?? null;

        if (previousState === "CLOSED") {
            if (isTripCondition(metrics)) {
                nextState = "OPEN";
                trippedAt = new Date();
            }
        } else if (previousState === "OPEN") {
            if (isResetCondition(metrics)) {
                nextState = "HALF_OPEN";
                resetConditionsMetSince = resetConditionsMetSince || new Date();
            } else {
                resetConditionsMetSince = null;
            }
        } else if (previousState === "HALF_OPEN") {
            if (isResetCondition(metrics)) {
                const heldSince = resetConditionsMetSince || new Date();
                if (Date.now() - heldSince.getTime() >= RESET_HOLD_MS) {
                    nextState = "CLOSED";
                    trippedAt = null;
                    resetConditionsMetSince = null;
                } else {
                    resetConditionsMetSince = heldSince;
                }
            } else {
                nextState = "OPEN";
                resetConditionsMetSince = null;
            }
        }

        await prisma.breakerState.upsert({
            where: { teamId },
            create: {
                teamId,
                state: nextState,
                trippedAt,
                resetConditionsMetSince,
                metrics: metrics as any
            },
            update: {
                state: nextState,
                trippedAt,
                resetConditionsMetSince,
                lastEvaluatedAt: new Date(),
                metrics: metrics as any
            }
        });

        if (previousState !== "OPEN" && nextState === "OPEN") {
            tripped += 1;
            await alertQueueOwner(teamId, metrics);
        }
    }

    return { teamsEvaluated: activeTeams.length, tripped };
}

export async function getBreakerState(teamId: string): Promise<BreakerStateValue> {
    const row = await prisma.breakerState.findUnique({ where: { teamId }, select: { state: true } });
    return (row?.state as BreakerStateValue) || "CLOSED";
}
