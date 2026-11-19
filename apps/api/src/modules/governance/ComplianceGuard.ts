
import { prisma } from "@/lib/db";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { classifyReply } from "@/lib/ai/jev";
import { readOptOut, type InboundClass } from "@/lib/optOutReader";

export class ComplianceGuard {

    /**
     * Reads an inbound message and returns what it is. Only a request to stop all contact
     * (OPT_OUT) is enforced here. The other classes are returned for the caller to act on:
     * NOT_INTERESTED / NOT_NOW end or pause one sequence, AUTO_REPLY is not a reply, and UNSURE
     * must go to a person: it is never suppressed and never continued automatically.
     * A clear opt-out is enforced without the model, so it still works when the model is down.
     */
    async checkInboundMessage(leadId: string, messageContent: string, opts: { subject?: string; headers?: Record<string, string> } = {}): Promise<InboundClass> {
        let cls: InboundClass;
        let pass: "deterministic" | "model";

        const read = readOptOut({ subject: opts.subject, body: messageContent, headers: opts.headers });
        if (read) {
            cls = read.class;
            pass = "deterministic";
        } else {
            cls = await this.askModel(leadId, opts.subject ?? "", messageContent);
            pass = "model";
        }

        // Class and deciding pass only: the message text is never logged.
        await this.audit(leadId, "COMPLIANCE_INBOUND_CLASSIFIED", { class: cls, pass });

        if (cls === "OPT_OUT") {
            await this.enforceOptOut(leadId, "User replied with a request to stop");
        }
        return cls;
    }

    // The model sees masked text only. Any failure is UNSURE, never a guess.
    private async askModel(leadId: string, subject: string, body: string): Promise<InboundClass> {
        try {
            const lead = await prisma.lead.findFirst({ where: { id: leadId }, select: { teamId: true, fullName: true, company: true } });
            if (!lead?.teamId) return "UNSURE";
            const masked = await SovereignFirewall.mask(body, "GLOBAL", undefined, { alwaysMask: true });
            const maskedSubject = await SovereignFirewall.mask(subject, "GLOBAL", undefined, { alwaysMask: true });
            const names = { person: lead.fullName, company: lead.company };
            const safeBody = SovereignFirewall.maskKnownNames(masked.safeContext, names, masked.tokenMap).safeContext;
            const safeSubject = SovereignFirewall.maskKnownNames(maskedSubject.safeContext, names, maskedSubject.tokenMap).safeContext;
            const { classification } = await classifyReply({ subject: safeSubject, body: safeBody }, lead.teamId);
            switch (classification) {
                case "DNC": return "OPT_OUT";
                case "NOT_INTERESTED": return "NOT_INTERESTED";
                case "OOO": return "AUTO_REPLY";
                default: return "NEUTRAL";
            }
        } catch {
            return "UNSURE";
        }
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

        // 1b. Withdraw every consent on record, on every channel, so the ledger agrees with the flag above.
        // Not swallowed: if this fails the job retries rather than reporting the opt-out as done.
        await prisma.consentLedger.updateMany({
            where: { leadId, status: "GRANTED" },
            data: { status: "REVOKED", revokedAt: new Date() },
        });

        // 2. If this lead belongs to a campaign, mark them as DNC in all campaign contexts
        if (leadId) {
            // Find all leads with the same email or linkedIn in other campaigns and mark them DNC too
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (lead?.email) {
                // Campaign sends check the suppression list, so an opt-out has to be on it too.
                const email = lead.email.toLowerCase();
                if (lead.teamId) await prisma.suppressionEntry.upsert({
                    where: { teamId_email: { teamId: lead.teamId, email } },
                    create: { teamId: lead.teamId, email, reason: "OPT_OUT", source: "COMPLIANCE_GUARD", leadId },
                    update: { reason: "OPT_OUT", source: "COMPLIANCE_GUARD", leadId },
                });
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
        await this.audit(leadId, "COMPLIANCE_OPT_OUT", { reason });
    }

    /**
     * Writes a compliance audit row for the lead's own team, with no actor (a system action).
     * AuditLog.orgId and actorId are foreign keys to Team and User, so a placeholder such as "SYSTEM"
     * is rejected by the database. A failed audit write is logged but never blocks enforcing an opt-out.
     */
    private async audit(leadId: string, action: string, metadata: Record<string, unknown>) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true } });
            if (!lead?.teamId) {
                console.error(`[Compliance] No team for lead ${leadId}; ${action} not written to the audit log`);
                return;
            }
            await prisma.auditLog.create({
                data: { orgId: lead.teamId, actorId: null, action, entity: "Lead", entityId: leadId, metadata },
            });
        } catch (error) {
            console.error(`[Compliance] Could not write ${action} to the audit log:`, error);
        }
    }
}

export const complianceGuard = new ComplianceGuard();
