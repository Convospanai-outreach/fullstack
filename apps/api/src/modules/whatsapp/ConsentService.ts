import { prisma } from "@/lib/db";

export enum ConsentMethod {
    IN_PERSON_MEETING = "IN_PERSON_MEETING",
    EMAIL_REPLY = "EMAIL_REPLY",
    PHONE_CALL = "PHONE_CALL",
    WEB_FORM = "WEB_FORM",
    VERBAL_CONFIRMATION = "VERBAL_CONFIRMATION"
}

const INBOUND_REPLY_PURPOSE = "INBOUND_REPLY";
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export class ConsentService {

    /**
     * Records explicit consent with full audit trail
     * DPDP Act 2023 Compliance: Must log who, when, how
     */
    static async recordConsent(
        leadId: string,
        userId: string | null, // null when the person consented themselves (a landing page form)
        method: ConsentMethod,
        notes?: string,
        channel: string = "WHATSAPP",
        evidence?: { proof?: string; ipAddress?: string | null }
    ) {
        // 1. Create Ledger Entry (Source of Truth)
        await prisma.consentLedger.create({
            data: {
                leadId,
                userId,
                channel,
                purpose: "MARKETING_AND_SUPPORT", // Default purpose for now
                status: "GRANTED",
                proof: evidence?.proof ?? null,
                notes: notes || null,
                ipAddress: evidence?.ipAddress ?? null
            }
        });

        // 2. Update Lead record (Cache) — the whatsappConsent* columns are WhatsApp-specific;
        // other channels rely on the ConsentLedger above as their source of truth.
        const lead = channel === "WHATSAPP"
            ? await prisma.lead.update({
                where: { id: leadId },
                data: {
                    whatsappConsent: true,
                    whatsappConsentAt: new Date(),
                    whatsappConsentBy: userId
                }
            })
            : await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

        // Create immutable audit log
        const { AuditService } = await import("@/modules/audit/auditService");

        if (lead.teamId) {
            await AuditService.log(
                lead.teamId,
                userId,
                "CONSENT_GRANTED",
                "Lead",
                leadId,
                {
                    consentType: channel,
                    method,
                    notes,
                    leadEmail: lead.email,
                    timestamp: new Date().toISOString()
                }
            );
        }

        return lead;
    }

    /**
     * Validates that consent exists before allowing messaging on the given channel
     */
    static async validateConsent(leadId: string, channel: string = "WHATSAPP"): Promise<{
        hasConsent: boolean;
        reason?: string;
    }> {
        // GDPR / DPDP Compliance: the lead's latest ledger entry for the channel decides, so an
        // opt-out after a grant blocks sends (revocations are new rows; revokedAt isn't set).
        const latest = await prisma.consentLedger.findFirst({
            where: { leadId, channel },
            orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
            select: { status: true, purpose: true }
        });

        if (latest?.status !== "GRANTED") {
            return { hasConsent: false, reason: latest ? `${channel} consent was revoked` : `No active ${channel} consent found in ledger` };
        }

        // A person who only messaged us first can be answered while WhatsApp's 24-hour reply window from
        // their last message is open. It is not consent to outreach, so it lapses with the window.
        if (latest.purpose === INBOUND_REPLY_PURPOSE) {
            const open = await prisma.whatsAppMessage.findFirst({
                where: { leadId, direction: "INBOUND", createdAt: { gte: new Date(Date.now() - REPLY_WINDOW_MS) } },
                select: { id: true }
            });
            if (!open) return { hasConsent: false, reason: "The 24-hour reply window has closed. The customer needs to message again, or give consent." };
        }

        return { hasConsent: true };
    }

    /**
     * A lead wrote to the team's WhatsApp number first: allow replies for the next 24 hours.
     * Does nothing for a lead that already has any WhatsApp consent history (granted or revoked), so
     * it never overrides an opt-out, and it leaves the lead's consent flag off so sequences stay blocked.
     */
    static async recordInboundReplyWindow(leadId: string) {
        const existing = await prisma.consentLedger.findFirst({ where: { leadId, channel: "WHATSAPP" }, select: { id: true } });
        if (existing) return;
        await prisma.consentLedger.create({
            data: {
                leadId,
                userId: null,
                channel: "WHATSAPP",
                purpose: INBOUND_REPLY_PURPOSE,
                status: "GRANTED",
                notes: "Customer messaged first. Replies allowed within 24 hours of their last message; not consent to outreach."
            }
        });
    }

    /**
     * Revokes consent (Opt-Out)
     * DPDP Act 2023: Users must be able to withdraw consent easily
     */
    static async revokeConsent(leadId: string, userId?: string, reason?: string, channel: string = "WHATSAPP") {
        // 1. Create Ledger Entry (Revocation)
        await prisma.consentLedger.create({
            data: {
                leadId,
                userId: userId || null,
                channel,
                purpose: "REVOCATION",
                status: "REVOKED", // Using string literal matching the Enum
                notes: reason || null
            }
        });

        // 2. Update Lead (Cache) — WhatsApp-specific column, see recordConsent.
        const lead = channel === "WHATSAPP"
            ? await prisma.lead.update({
                where: { id: leadId },
                data: {
                    whatsappConsent: false
                }
            })
            : await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

        // Log revocation
        const { AuditService } = await import("@/modules/audit/auditService");

        if (lead.teamId) {
            await AuditService.log(
                lead.teamId,
                userId || null,
                "CONSENT_REVOKED",
                "Lead",
                leadId,
                {
                    consentType: channel,
                    reason,
                    revokedAt: new Date().toISOString()
                }
            );
        }

        return lead;
    }

    /**
     * Get consent audit history for a lead
     */
    static async getConsentHistory(leadId: string) {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { teamId: true }
        });

        if (!lead?.teamId) {
            return [];
        }

        const auditLogs = await prisma.auditLog.findMany({
            where: {
                orgId: lead.teamId,
                entityId: leadId,
                action: { in: ["CONSENT_GRANTED", "CONSENT_REVOKED"] }
            },
            orderBy: { createdAt: "desc" }
        });

        return auditLogs;
    }
}
