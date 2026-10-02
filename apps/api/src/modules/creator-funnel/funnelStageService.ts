import type { FunnelStage } from "@prisma/client";
import { prisma } from "@/lib/db";

// Creator-funnel stage transitions. Stages only move forward (TOFU -> MOFU -> BOFU -> POST)
// unless a caller passes `force`; every change is logged to LeadActivity (channel "funnel")
// and, when Mautic is configured, mirrored as a stage tag.

export const FUNNEL_STAGE_ORDER: readonly FunnelStage[] = ["TOFU", "MOFU", "BOFU", "POST"];

// The named transitions. Callers use these rather than picking a stage themselves.
export const STAGE_FOR_EVENT = {
    social_first_touch: "TOFU",
    landing_opt_in: "MOFU",
    checkout_started: "BOFU",
    call_booked: "BOFU",
    payment_succeeded: "POST",
} as const satisfies Record<string, FunnelStage>;

export type FunnelEvent = keyof typeof STAGE_FOR_EVENT;

export type StageChange = { changed: boolean; from: FunnelStage | null; to: FunnelStage };

export async function moveLeadToStage(input: {
    teamId: string;
    leadId: string;
    to: FunnelStage;
    reason: FunnelEvent | "manual";
    force?: boolean;
    actorUserId?: string | null;
}): Promise<StageChange> {
    const { teamId, leadId, to } = input;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { funnelStage: true } });
    if (!lead) throw new Error("Lead not found");

    const from = lead.funnelStage;
    const backward = from !== null && FUNNEL_STAGE_ORDER.indexOf(to) < FUNNEL_STAGE_ORDER.indexOf(from);
    if (from === to || (backward && !input.force)) return { changed: false, from, to };

    // Conditional on the stage we read, so two concurrent transitions can't both log a change.
    const updated = await prisma.lead.updateMany({ where: { id: leadId, teamId, funnelStage: from }, data: { funnelStage: to } });
    if (updated.count === 0) return { changed: false, from, to };

    await prisma.leadActivity.create({
        data: {
            leadId,
            channel: "funnel",
            type: "stage_change",
            title: `Moved to ${to}`,
            metadata: { from, to, reason: input.reason, forced: Boolean(input.force && backward) },
            createdBy: input.actorUserId ?? null,
        },
    });

    // Best effort and never awaited: Mautic is optional and bounded by its own timeout.
    const { mauticService } = await import("@/modules/mautic-integration/service/mauticService");
    void mauticService.tagFunnelStage(leadId, teamId, to);

    return { changed: true, from, to };
}

export function applyFunnelEvent(teamId: string, leadId: string, event: FunnelEvent, actorUserId?: string | null) {
    return moveLeadToStage({ teamId, leadId, to: STAGE_FOR_EVENT[event], reason: event, actorUserId: actorUserId ?? null });
}
