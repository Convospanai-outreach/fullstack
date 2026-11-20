import { prisma } from "@/lib/db";

// DPDP send gate: a lead may be contacted on a channel only with consent for that channel, or a proven public source.
// Off until a team turns it on (Team.sendSafety.DPDP_SEND_GATE === true), so existing teams send exactly as before.
// Mirrored in apps/web/src/modules/governance/lawfulBasis.ts; a parity test keeps the two copies identical.

export const NO_LAWFUL_BASIS_REASON = "No consent or proven public source";

export type ContactChannel = "EMAIL" | "WHATSAPP";

export type LawfulBasisFields = {
    lawfulBasis?: string | null;
    sourceUrl?: string | null;
    publishedBySubject?: boolean | null;
};

export type ConsentRow = {
    channel: string;
    status: string;
    revokedAt?: Date | null;
    grantedAt: Date;
    purpose?: string | null;
};

// ConsentService writes a GRANTED row when a customer messages first. Its own note says it is "not consent to
// outreach" (it only opens the 24-hour reply window), so it never counts here.
const INBOUND_REPLY_PURPOSE = "INBOUND_REPLY";

// Revoking consent adds a newer REVOKED row; it does not edit the old GRANTED one. So the newest row for the
// channel decides, not the existence of any granted row.
function hasConsent(channel: ContactChannel, ledger: ConsentRow[]): boolean {
    const rows = ledger
        .filter((r) => r.channel.toUpperCase() === channel && r.purpose !== INBOUND_REPLY_PURPOSE)
        .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
    const latest = rows[0];
    return Boolean(latest) && latest!.status === "GRANTED" && !latest!.revokedAt;
}

function hasProvenPublicSource(lead: LawfulBasisFields, channel: ContactChannel, ledger: ConsentRow[]): boolean {
    if (lead.lawfulBasis !== "PUBLIC_SOURCE" || !lead.sourceUrl?.trim() || lead.publishedBySubject !== true) return false;
    // A person who withdrew consent on this channel stays blocked whatever the source says.
    const latest = ledger
        .filter((r) => r.channel.toUpperCase() === channel && r.purpose !== INBOUND_REPLY_PURPOSE)
        .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())[0];
    return !(latest && (latest.status === "REVOKED" || latest.revokedAt));
}

export function canContact(lead: LawfulBasisFields, channel: ContactChannel, ledger: ConsentRow[]): boolean {
    return hasConsent(channel, ledger) || hasProvenPublicSource(lead, channel, ledger);
}

export type SendGateResult = { allowed: true } | { allowed: false; reason: string };

// Never swallows a database error: if the check cannot run with the gate on, the send must not go out unchecked.
export async function checkSendGate(input: { leadId: string; teamId: string; channel: ContactChannel }): Promise<SendGateResult> {
    const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { sendSafety: true } });
    const settings = team?.sendSafety && typeof team.sendSafety === "object" ? (team.sendSafety as Record<string, unknown>) : null;
    if (settings?.["DPDP_SEND_GATE"] !== true) return { allowed: true };

    const lead = await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: { teamId: true, lawfulBasis: true, sourceUrl: true, publishedBySubject: true },
    });
    if (!lead || lead.teamId !== input.teamId) return { allowed: false, reason: NO_LAWFUL_BASIS_REASON };

    const ledger = await prisma.consentLedger.findMany({
        where: { leadId: input.leadId, channel: input.channel },
        select: { channel: true, status: true, revokedAt: true, grantedAt: true, purpose: true },
    });
    return canContact(lead, input.channel, ledger) ? { allowed: true } : { allowed: false, reason: NO_LAWFUL_BASIS_REASON };
}
