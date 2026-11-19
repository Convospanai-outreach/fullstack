import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConsentService, type ConsentMethod } from "@/modules/whatsapp/ConsentService";

// One place for "this capture path says the person consented": a ConsentLedger row (who, how, proof, IP)
// plus the legacy Lead.consentObtained flag kept in step. Only call it when the capture actually carried a
// consent signal (a ticked box, a consent column, an importer's attestation). Absence of a signal writes nothing.
export async function recordCaptureConsent(input: {
    leadId: string;
    userId: string | null;
    method: ConsentMethod | `${ConsentMethod}`;
    notes: string;
    proof: string;
    ipAddress?: string | null;
    channel?: "EMAIL" | "WHATSAPP" | "PHONE";
}): Promise<boolean> {
    const channel = input.channel ?? "EMAIL";
    try {
        const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, status: true } });
        // An opted-out lead stays opted out: a form that comes in later does not switch consent back on.
        if (!lead || lead.status === "DNC") return false;

        const already = await prisma.consentLedger.findFirst({
            where: { leadId: input.leadId, channel, status: "GRANTED", proof: input.proof },
            select: { id: true },
        });
        if (already) return false;

        await ConsentService.recordConsent(input.leadId, input.userId, input.method as ConsentMethod, input.notes, channel, {
            proof: input.proof,
            ipAddress: input.ipAddress ?? null,
        });
        await prisma.lead.update({ where: { id: input.leadId }, data: { consentObtained: true } });
        return true;
    } catch (error) {
        // The lead is already saved. A missing ledger row only makes the lead harder to contact, never easier.
        logger.warn(`[captureConsent] Could not record ${channel} consent for lead ${input.leadId}: ${error instanceof Error ? error.message : error}`);
        return false;
    }
}
