import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Web-side twin of apps/api/src/modules/governance/captureConsent.ts: a capture path that carried a consent
// signal (a manual tick, a CSV consent column) writes a ConsentLedger row (who, proof, IP) and keeps the legacy
// Lead.consentObtained flag in step. Writes the ledger directly because this app's ConsentService has no
// proof or IP support. Call it only when the capture actually carried a consent signal.
export async function recordCaptureConsent(input: {
    leadId: string;
    userId: string | null;
    notes: string;
    proof: string;
    ipAddress?: string | null;
    channel?: "EMAIL" | "WHATSAPP" | "PHONE";
}): Promise<boolean> {
    const channel = input.channel ?? "EMAIL";
    try {
        const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, status: true } });
        // An opted-out lead stays opted out.
        if (!lead || lead.status === "DNC") return false;

        const already = await prisma.consentLedger.findFirst({
            where: { leadId: input.leadId, channel, status: "GRANTED", proof: input.proof },
            select: { id: true },
        });
        if (already) return false;

        await prisma.consentLedger.create({
            data: {
                leadId: input.leadId,
                userId: input.userId,
                channel,
                purpose: "MARKETING_AND_SUPPORT",
                status: "GRANTED",
                proof: input.proof,
                notes: input.notes,
                ipAddress: input.ipAddress ?? null,
            },
        });
        await prisma.lead.update({ where: { id: input.leadId }, data: { consentObtained: true } });
        return true;
    } catch (error) {
        // The lead is already saved. A missing ledger row only makes the lead harder to contact, never easier.
        logger.warn(`[captureConsent] Could not record ${channel} consent for lead ${input.leadId}: ${error instanceof Error ? error.message : error}`);
        return false;
    }
}
