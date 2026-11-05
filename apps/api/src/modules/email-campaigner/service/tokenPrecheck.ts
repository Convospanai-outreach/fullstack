import { prisma } from "@/lib/db";
import { resolveMessageTokens } from "./messageTokens";

// Before a campaign starts: which merge fields in its email steps would be empty (or mistyped) for which
// contacts, so the sender can fix them first instead of finding held emails afterwards. Uses the same resolver
// as the send, so the answer matches what would be held. Team scoped.

const MAX_LEADS = 5000;
const SAMPLE_SIZE = 3;
const DEFAULT_SUBJECT = "Following up"; // what the send uses when a step has no subject

export interface TokenIssue {
    token: string;
    reason: "empty" | "unknown";
    suggestedFallback: string | null;
    advice: string;
    leadsAffected: number;
    sampleLeads: Array<{ id: string; name: string | null; email: string | null }>;
}

export interface StepTokenReport {
    stepId: string;
    stepOrder: number;
    subject: string;
    contactsHeld: number;
    issues: TokenIssue[];
}

export interface CampaignTokenReport {
    leadsChecked: number;
    truncated: boolean;
    steps: StepTokenReport[];
}

export async function checkCampaignTokens(teamId: string, campaignId: string): Promise<CampaignTokenReport | null> {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId }, select: { id: true } });
    if (!campaign) return null;

    const sequence = await prisma.campaignSequence.findFirst({
        where: { campaignId, teamId },
        include: { steps: { where: { status: "ACTIVE" }, orderBy: { stepOrder: "asc" } } },
    });
    const emailSteps = (sequence?.steps ?? []).filter((s: any) => String(s.stepType ?? "").toLowerCase() === "email" && s.body?.trim());

    const leads = await prisma.lead.findMany({
        where: { campaignId, teamId },
        select: { id: true, fullName: true, email: true, company: true, jobTitle: true, location: true, customFields: true },
        orderBy: { createdAt: "asc" },
        take: MAX_LEADS + 1,
    });
    const truncated = leads.length > MAX_LEADS;
    const checked = truncated ? leads.slice(0, MAX_LEADS) : leads;

    const steps: StepTokenReport[] = emailSteps.map((step: any) => {
        const subject = step.subject?.trim() || DEFAULT_SUBJECT;
        const byToken = new Map<string, TokenIssue>();
        let contactsHeld = 0;

        for (const lead of checked) {
            const found = [
                ...resolveMessageTokens(subject, lead).missing,
                ...resolveMessageTokens(step.body, lead, { html: true }).missing,
            ];
            if (found.length === 0) continue;
            contactsHeld += 1;
            // The same token can appear in both subject and body; count the contact once per token.
            const countedForLead = new Set<string>();
            for (const m of found) {
                if (countedForLead.has(m.token)) continue;
                countedForLead.add(m.token);
                let issue = byToken.get(m.token);
                if (!issue) {
                    issue = { token: m.token, reason: m.reason, suggestedFallback: m.suggestedFallback, advice: m.advice, leadsAffected: 0, sampleLeads: [] };
                    byToken.set(m.token, issue);
                }
                issue.leadsAffected += 1;
                if (issue.sampleLeads.length < SAMPLE_SIZE) issue.sampleLeads.push({ id: lead.id, name: lead.fullName ?? null, email: lead.email ?? null });
            }
        }

        const issues = [...byToken.values()].sort((a, b) => b.leadsAffected - a.leadsAffected);
        return { stepId: step.id, stepOrder: step.stepOrder, subject, contactsHeld, issues };
    });

    return { leadsChecked: checked.length, truncated, steps };
}
