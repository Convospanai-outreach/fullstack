import { prisma } from "@/lib/db";

export enum ConsentMethod {
    IN_PERSON_MEETING = "IN_PERSON_MEETING",
    EMAIL_REPLY = "EMAIL_REPLY",
    PHONE_CALL = "PHONE_CALL",
    WEB_FORM = "WEB_FORM",
    VERBAL_CONFIRMATION = "VERBAL_CONFIRMATION"
}

export class ConsentService {

    /**
     * Records explicit WhatsApp consent with full audit trail
     * DPDP Act 2023 Compliance: Must log who, when, how
     */
    static async recordConsent(
        leadId: string,
        userId: string,
        method: ConsentMethod,
        notes?: string
    ) {
        // 1. Create Ledger Entry (Source of Truth)
        await prisma.consentLedger.create({
            data: {
                leadId,
                userId,
                channel: "WHATSAPP",
                purpose: "MARKETING_AND_SUPPORT", // Default purpose for now
                status: "GRANTED",
                proof: null, // Can be added later
                notes
            }
        });

        // 2. Update Lead record (Cache)
        const lead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                whatsappConsent: true,
                whatsappConsentAt: new Date(),
                whatsappConsentBy: userId
            }
        });

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
                    consentType: "WHATSAPP",
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
     * Validates that consent exists before allowing WhatsApp messaging
     */
    static async validateConsent(leadId: string): Promise<{
        hasConsent: boolean;
        reason?: string;
    }> {
        // GDPR / DPDP Compliance: Check Ledger for active consent
        const activeConsent = await prisma.consentLedger.findFirst({
            where: {
                leadId,
                channel: "WHATSAPP",
                status: "GRANTED"
            },
            orderBy: { grantedAt: "desc" }
        });

        if (!activeConsent) {
            return { hasConsent: false, reason: "No active WhatsApp consent found in ledger" };
        }

        return { hasConsent: true };
    }

    /**
     * Revokes WhatsApp consent (Opt-Out)
     * DPDP Act 2023: Users must be able to withdraw consent easily
     */
    static async revokeConsent(leadId: string, userId?: string, reason?: string) {
        // 1. Create Ledger Entry (Revocation)
        await prisma.consentLedger.create({
            data: {
                leadId,
                userId: userId || null,
                channel: "WHATSAPP",
                purpose: "REVOCATION",
                status: "REVOKED", // Using string literal matching the Enum
                notes: reason
            }
        });

        // 2. Update Lead (Cache)
        const lead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                whatsappConsent: false
            }
        });

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
                    consentType: "WHATSAPP",
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
