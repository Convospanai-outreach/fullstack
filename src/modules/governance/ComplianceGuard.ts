
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); // Temp

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

        // 2. Stop all Active Campaigns for this Lead
        // (In a real system, we'd query relation tables, here we stub the logic)
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
