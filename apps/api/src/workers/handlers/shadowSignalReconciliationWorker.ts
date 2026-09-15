import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { findLeadForSignal, applyNetjanaEnrichmentToLead, queueNetjanaFollowup, type NetjanaSignalWithExtras } from "@/modules/intel/service/netjanaIntelService";

// A ShadowSignal that arrived before its matching lead existed persists with
// leadId: null forever - ingest is one-shot, nothing previously retried it.
// This re-attempts matching for orphaned signals on a periodic tick, bounded
// by batch size and age so the query stays cheap and doesn't chase signals
// that are never going to match.
const RECONCILE_BATCH_SIZE = 50;
const MAX_SIGNAL_AGE_DAYS = 30;

export async function reconcileOrphanedShadowSignals(): Promise<{ scanned: number; matched: number }> {
    const cutoff = new Date(Date.now() - MAX_SIGNAL_AGE_DAYS * 24 * 60 * 60 * 1000);

    const orphans = await prisma.shadowSignal.findMany({
        where: {
            leadId: null,
            source: "netjana-intel",
            teamId: { not: null },
            createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: "asc" },
        take: RECONCILE_BATCH_SIZE,
    });

    let matched = 0;

    for (const orphan of orphans) {
        try {
            const metadata = orphan.metadata as Record<string, unknown> | null;
            if (!metadata || !orphan.teamId) continue;

            // metadata was stored as { provider: "netjana-intel", ...signal, rawPayloadTrusted }
            // at ingest time (netjanaIntelService.ts) - reconstruct the signal from it.
            const { provider: _provider, rawPayloadTrusted: _trusted, ...signalFields } = metadata;
            const signal = signalFields as unknown as NetjanaSignalWithExtras;

            const { lead, matchConfidence } = await findLeadForSignal(orphan.teamId, signal);
            if (!lead) continue;

            signal.matchConfidence = matchConfidence;
            signal.matchStatus = "MATCHED";
            signal.matchedLeadId = lead.id;

            const followup = await queueNetjanaFollowup(orphan.teamId, signal, {
                id: lead.id,
                campaignId: lead.campaignId || signal.campaignId || null,
            });

            const marketContext = {
                source: "netjana-intel",
                companyName: signal.companyName,
                industry: signal.industry,
                buyingStage: signal.buyingStage,
                intentScore: signal.intentScore,
                signalStrength: signal.strengthPercent,
                whyNow: signal.whyNow,
                verificationMode: signal.verificationMode,
                signatureVerified: signal.signatureVerified,
                matchStatus: signal.matchStatus,
                matchConfidence: signal.matchConfidence,
                safeForAutomation: signal.safeForAutomation,
                trustedForKnowledge: signal.trustedForKnowledge,
                receivedAt: signal.timestamp,
            };

            await applyNetjanaEnrichmentToLead(lead, signal, marketContext, followup);

            await prisma.shadowSignal.update({
                where: { id: orphan.id },
                data: { leadId: lead.id, metadata: { ...metadata, matchStatus: "MATCHED", matchConfidence } },
            });

            matched++;
        } catch (error) {
            logger.warn("Failed to reconcile orphaned ShadowSignal", {
                signalId: orphan.id,
                error: error instanceof Error ? error.message : error,
            });
        }
    }

    return { scanned: orphans.length, matched };
}
