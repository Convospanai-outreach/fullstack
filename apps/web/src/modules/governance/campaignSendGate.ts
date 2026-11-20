import { prisma } from "@/lib/db";
import { canContact, NO_LAWFUL_BASIS_REASON, type ConsentRow } from "./lawfulBasis";

export type CampaignSendGateSummary =
    | { gateOn: false }
    | { gateOn: true; total: number; blocked: number; reason: string };

// For campaign start: how many of the campaign's leads the DPDP send gate would stop. Off unless the team set
// Team.sendSafety.DPDP_SEND_GATE. Campaign sends are email, so only email consent counts. The send itself is
// still gated per lead at send time; this only tells the person starting the campaign before anything is queued.
export async function summarizeCampaignSendGate(teamId: string, campaignId: string): Promise<CampaignSendGateSummary> {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
    const settings = team?.sendSafety && typeof team.sendSafety === "object" ? (team.sendSafety as Record<string, unknown>) : null;
    if (settings?.["DPDP_SEND_GATE"] !== true) return { gateOn: false };

    const leads = await prisma.lead.findMany({
        where: { campaignId, teamId },
        select: { id: true, lawfulBasis: true, sourceUrl: true, publishedBySubject: true },
    });
    if (leads.length === 0) return { gateOn: true, total: 0, blocked: 0, reason: NO_LAWFUL_BASIS_REASON };

    const rows = await prisma.consentLedger.findMany({
        where: { leadId: { in: leads.map((l) => l.id) }, channel: "EMAIL" },
        select: { leadId: true, channel: true, status: true, revokedAt: true, grantedAt: true, purpose: true },
    });
    const byLead = new Map<string, ConsentRow[]>();
    for (const row of rows) byLead.set(row.leadId, [...(byLead.get(row.leadId) ?? []), row]);

    const blocked = leads.filter((l) => !canContact(l, "EMAIL", byLead.get(l.id) ?? [])).length;
    return { gateOn: true, total: leads.length, blocked, reason: NO_LAWFUL_BASIS_REASON };
}
