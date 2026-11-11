import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { applyCustomFieldsPatch, pickPropertyAnswers, type PropertyDefinition } from "./leadProperties";

export async function loadActivePropertyDefinitions(teamId: string): Promise<PropertyDefinition[]> {
    const rows = await prisma.leadProperty.findMany({ where: { teamId, archivedAt: null } });
    return rows.map((row) => ({
        key: row.key,
        type: row.type as PropertyDefinition["type"],
        options: (row.options as string[] | null) ?? null,
        archivedAt: row.archivedAt,
    }));
}

// Copies a landing lead form's answers that match an active property onto the CRM lead.
// Called by the intake worker once the lead id is known. Never throws: the lead is already saved,
// and a bad answer is skipped (the submit route rejects bad answers before they get this far).
export async function saveLandingAnswersToLead(teamId: string, leadId: string, rawPayload: unknown): Promise<void> {
    const answers = (rawPayload as { answers?: unknown } | null)?.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return;

    try {
        const definitions = await loadActivePropertyDefinitions(teamId);
        const { values, errors } = pickPropertyAnswers(definitions, answers as Record<string, unknown>);
        for (const error of errors) {
            logger.warn(`[LeadCustomFields] Skipped an answer for ${error.key} on lead ${leadId}: ${error.message}`);
        }
        if (Object.keys(values).length === 0) return;

        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { customFields: true } });
        if (!lead) return;
        const merged = applyCustomFieldsPatch(definitions, (lead.customFields as Record<string, unknown> | null) ?? {}, values);
        if (!merged.ok) {
            logger.warn(`[LeadCustomFields] Not saved on lead ${leadId}: ${merged.message}`);
            return;
        }
        await prisma.lead.updateMany({
            where: { id: leadId, teamId },
            data: { customFields: merged.value as Prisma.InputJsonValue },
        });
    } catch (error) {
        logger.warn(`[LeadCustomFields] Could not save answers on lead ${leadId}: ${error instanceof Error ? error.message : error}`);
    }
}
