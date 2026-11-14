// Loads the six-step workflow for many leads at once (five queries, whatever the lead count),
// for the campaign summary and for lead cards. One lead at a time: routes/leads/[id]/workflow.
import { prisma } from "@/lib/db";
import { deriveLeadWorkflow, STEP_RULES, type StepKey, type WorkflowStep } from "@/lib/leadWorkflow";

export type LeadWorkflow = ReturnType<typeof deriveLeadWorkflow>;

/** Workflows keyed by lead id. Leads outside `teamId` are left out. */
export async function loadLeadWorkflows(teamId: string, leadIds: string[]): Promise<Map<string, LeadWorkflow>> {
    const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds }, teamId },
        select: {
            id: true,
            isEnriched: true,
            lastScoredAt: true,
            dwellTimeMinutes: true,
            emailClicks: true,
            socialMentions: true,
            icpFitScore: true,
            replyOutcome: true,
            pipelineState: true,
            status: true,
            wonAt: true,
        },
    });
    const ids = leads.map((l) => l.id);
    if (ids.length === 0) return new Map();

    const [emails, replied, generations, channels, approvals] = await Promise.all([
        prisma.email.groupBy({ by: ["leadId"], where: { leadId: { in: ids } }, _count: { _all: true } }),
        prisma.email.groupBy({ by: ["leadId"], where: { leadId: { in: ids }, repliedAt: { not: null } }, _count: { _all: true } }),
        prisma.generation.groupBy({ by: ["leadId"], where: { leadId: { in: ids } }, _count: { _all: true } }),
        prisma.leadChannelStatus.findMany({ where: { leadId: { in: ids } }, select: { leadId: true, status: true } }),
        prisma.approvalRequest.findMany({
            where: { teamId, entityType: "Lead", entityId: { in: ids } },
            orderBy: { createdAt: "desc" },
            select: { id: true, entityId: true, status: true, actionType: true, reason: true, autoDenyAt: true },
        }),
    ]);

    const countBy = (rows: { leadId: string | null; _count: { _all: number } }[]) =>
        new Map(rows.map((r) => [r.leadId, r._count._all]));
    const emailCount = countBy(emails);
    const repliedCount = countBy(replied);
    const generationCount = countBy(generations);

    const channelStatuses = new Map<string, string[]>();
    for (const c of channels) channelStatuses.set(c.leadId, [...(channelStatuses.get(c.leadId) ?? []), c.status]);

    // Newest first, so the first one seen for a lead is its latest.
    const latestApproval = new Map<string, (typeof approvals)[number]>();
    for (const a of approvals) if (!latestApproval.has(a.entityId)) latestApproval.set(a.entityId, a);

    return new Map(
        leads.map((lead) => [
            lead.id,
            deriveLeadWorkflow({
                lead,
                emailCount: emailCount.get(lead.id) ?? 0,
                repliedEmailCount: repliedCount.get(lead.id) ?? 0,
                generationCount: generationCount.get(lead.id) ?? 0,
                channelStatuses: channelStatuses.get(lead.id) ?? [],
                approval: latestApproval.get(lead.id) ?? null,
            }),
        ])
    );
}

export interface StepSummary {
    key: StepKey;
    label: string;
    gated: boolean;
    rule: string;
    /** Leads that have completed this step. */
    done: number;
    /** Leads whose current step this is (in progress or waiting on someone). */
    current: number;
    /** Leads stopped here by a rejected approval. */
    blocked: number;
}

/** How many leads sit at each step. */
export function summariseWorkflows(workflows: Iterable<LeadWorkflow>): StepSummary[] {
    const summary = new Map<StepKey, StepSummary>();
    for (const { steps } of workflows) {
        for (const step of steps as WorkflowStep[]) {
            const row =
                summary.get(step.key) ??
                { key: step.key, label: step.label, gated: step.gated, rule: STEP_RULES[step.key], done: 0, current: 0, blocked: 0 };
            if (step.state === "done") row.done += 1;
            else if (step.state === "blocked") row.blocked += 1;
            else if (step.state === "active" || step.state === "waiting") row.current += 1;
            summary.set(step.key, row);
        }
    }
    return [...summary.values()];
}
