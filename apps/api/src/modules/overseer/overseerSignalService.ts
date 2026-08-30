import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Provider-degradation detection is the one OverseerSignal category buildable honestly today
// (OVERSEER_ARCHITECTURE_PLAN.md §01's secondary function): LLMUsageLog has been populated
// since the aiService.ts reliability work, so a failure-rate-over-a-window signal reflects
// real data. ICP-drift/cost-drift-vs-baseline signals are NOT implemented - there is no
// historical baseline yet for either, and fabricating one would be a hollow stub.
const WINDOW_MS = 30 * 60 * 1000; // matches the Overseer tick cadence
const MIN_SAMPLE_SIZE = parseInt(process.env["OVERSEER_SIGNAL_MIN_SAMPLE"] || "5");
const WARN_FAILURE_RATE = parseFloat(process.env["OVERSEER_SIGNAL_WARN_RATE"] || "0.5");
const CRITICAL_FAILURE_RATE = parseFloat(process.env["OVERSEER_SIGNAL_CRITICAL_RATE"] || "0.8");

const CATEGORY_PROVIDER_DEGRADATION = "PROVIDER_DEGRADATION";

type ProviderStats = { total: number; failures: number };

/**
 * Detects LLM provider outages/degradation from the last WINDOW_MS of LLMUsageLog rows.
 * Deliberately does NOT escalate into ApprovalRequest: "provider X is degraded" has no
 * human approve/reject decision behind it - aiService.ts's own retry/fallback chain
 * already reacts automatically. This is observability only.
 */
export async function detectProviderDegradation(): Promise<{ providersChecked: number; signalsOpened: number; signalsResolved: number }> {
    const windowStart = new Date(Date.now() - WINDOW_MS);

    const rows = await prisma.lLMUsageLog.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { provider: true, success: true }
    });

    const statsByProvider = new Map<string, ProviderStats>();
    for (const row of rows) {
        const stats = statsByProvider.get(row.provider) || { total: 0, failures: 0 };
        stats.total += 1;
        if (!row.success) stats.failures += 1;
        statsByProvider.set(row.provider, stats);
    }

    let signalsOpened = 0;
    let signalsResolved = 0;

    for (const [provider, stats] of statsByProvider) {
        if (stats.total < MIN_SAMPLE_SIZE) continue;

        const failureRate = stats.failures / stats.total;
        const existing = await prisma.overseerSignal.findFirst({
            where: { category: CATEGORY_PROVIDER_DEGRADATION, subject: provider, status: "OPEN" }
        });

        if (failureRate >= WARN_FAILURE_RATE) {
            const severity = failureRate >= CRITICAL_FAILURE_RATE ? "CRITICAL" : "WARN";
            const summary = `Provider "${provider}" failed ${stats.failures}/${stats.total} calls (${(failureRate * 100).toFixed(0)}%) in the last 30 minutes.`;
            const evidence = { windowStart: windowStart.toISOString(), ...stats, failureRate };

            if (existing) {
                await prisma.overseerSignal.update({
                    where: { id: existing.id },
                    data: { severity, summary, evidence }
                });
            } else {
                await prisma.overseerSignal.create({
                    data: { category: CATEGORY_PROVIDER_DEGRADATION, subject: provider, severity, summary, evidence, status: "OPEN" }
                });
                signalsOpened += 1;
                logger.error("[OverseerSignal] Provider degradation detected", { provider, ...stats, failureRate });
            }
        } else if (existing) {
            await prisma.overseerSignal.update({
                where: { id: existing.id },
                data: { status: "RESOLVED", resolvedAt: new Date() }
            });
            signalsResolved += 1;
        }
    }

    return { providersChecked: statsByProvider.size, signalsOpened, signalsResolved };
}
