
import { prisma } from "@/lib/db";

export class ComplianceGuard {

    private readonly STOP_KEYWORDS = ["stop", "unsubscribe", "remove", "opt out", "not interested"];

    /**
     * Checks inbound message for compliance triggers.
     * If detected, immediately halts all campaigns for this lead.
     */
    async checkInboundMessage(leadId: string, messageContent: string): Promise<boolean> {
        const content = messageContent.toLowerCase();

        // 1. Check for Opt-Out Keywords
        const isStop = this.STOP_KEYWORDS.some(k => content.includes(k));

        if (isStop) {
            console.log(`[Compliance] STOP signal detected for Lead ${leadId}`);
            await this.enforceOptOut(leadId, "User replied STOP");
            return true;
        }

        return false;
    }

    /**
     * Enforces the opt-out by updating Lead status and Consent flags.
     */
    async enforceOptOut(leadId: string, reason: string) {
        // 1. Mark Lead as Do Not Contact
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: "DNC", // Do Not Contact
                consentObtained: false,
            }
        });

        // 2. If this lead belongs to a campaign, mark them as DNC in all campaign contexts
        if (leadId) {
            // Find all leads with the same email or linkedIn in other campaigns and mark them DNC too
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (lead?.email) {
                const updated = await prisma.lead.updateMany({
                    where: {
                        email: lead.email,
                        id: { not: leadId },
                        status: { not: 'DNC' }
                    },
                    data: { status: 'DNC', consentObtained: false }
                });
                if (updated.count > 0) {
                    console.log(`[Compliance] Deactivated ${updated.count} related lead records for opt-out`);
                }
            }
        }

        console.log(`[Compliance] Enforced Opt-Out for Lead ${leadId}: ${reason}`);

        // 3. Log into Audit Trail for Legal Proof
        await prisma.auditLog.create({
            data: {
                orgId: "SYSTEM",
                actorId: "SYSTEM",
                action: "COMPLIANCE_OPT_OUT",
                entity: "Lead",
                entityId: leadId,
                metadata: { reason },
            }
        });
    }
}

export const complianceGuard = new ComplianceGuard();
