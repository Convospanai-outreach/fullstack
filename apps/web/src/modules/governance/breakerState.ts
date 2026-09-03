import { prisma } from "@/lib/db";

export type BreakerStateValue = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Read-only lookup of the Overseer circuit breaker state for a team (see
 * OVERSEER_ARCHITECTURE_PLAN.md §04). The breaker is evaluated by apps/api's
 * worker tick (breakerService.ts) against the same BreakerState table; this
 * app only ever reads it, never writes it.
 */
export async function getBreakerState(teamId: string): Promise<BreakerStateValue> {
    const row = await prisma.breakerState.findUnique({ where: { teamId }, select: { state: true } });
    return (row?.state as BreakerStateValue) || "CLOSED";
}
