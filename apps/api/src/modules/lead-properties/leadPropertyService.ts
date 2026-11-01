import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError } from "@/lib/apiResponse";
import { AuditService } from "@/modules/audit/auditService";
import {
    applyCustomFieldsPatch,
    MAX_LEAD_PROPERTIES_PER_TEAM,
    validatePropertyDefinition,
    type PropertyDefinition,
} from "./leadProperties";

// Team-scoped reads and writes for property definitions and a lead's property values.
// Routes check the role; every query here filters by teamId.

export interface LeadPropertyInput {
    key: string;
    label: string;
    type: string;
    options?: unknown;
}

export async function listLeadProperties(teamId: string, includeArchived = false) {
    return prisma.leadProperty.findMany({
        where: includeArchived ? { teamId } : { teamId, archivedAt: null },
        orderBy: { createdAt: "asc" },
    });
}

export async function createLeadProperty(teamId: string, userId: string, input: LeadPropertyInput) {
    const definition = validatePropertyDefinition({ key: input.key, label: input.label, type: input.type, options: input.options });
    if (!definition.ok) throw new APIError(definition.message, 400, "VALIDATION_ERROR");

    // Archived rows count too: the key stays taken, so a create and archive loop cannot grow the table without bound.
    const existing = await prisma.leadProperty.count({ where: { teamId } });
    if (existing >= MAX_LEAD_PROPERTIES_PER_TEAM) {
        throw new APIError(`A team can have at most ${MAX_LEAD_PROPERTIES_PER_TEAM} custom properties`, 400, "LIMIT_REACHED");
    }

    let created;
    try {
        created = await prisma.leadProperty.create({
            data: {
                teamId,
                key: input.key,
                label: definition.value.label,
                type: definition.value.type,
                ...(definition.value.options ? { options: definition.value.options } : {}),
            },
        });
    } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
            throw new APIError("A property with this key already exists", 409, "CONFLICT");
        }
        throw error;
    }

    await AuditService.log(teamId, userId, "LEAD_PROPERTY_CREATE", "LeadProperty", created.id, {
        key: created.key,
        label: created.label,
        type: created.type,
    });
    return created;
}

export async function renameLeadProperty(teamId: string, userId: string, id: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed || trimmed.length > 100) throw new APIError("Label must be 1 to 100 characters", 400, "VALIDATION_ERROR");

    const result = await prisma.leadProperty.updateMany({ where: { id, teamId }, data: { label: trimmed } });
    if (result.count !== 1) throw new APIError("Property not found", 404, "NOT_FOUND");

    await AuditService.log(teamId, userId, "LEAD_PROPERTY_RENAME", "LeadProperty", id, { label: trimmed });
}

// Hides the property. Values already on leads are kept, so an accidental archive loses nothing.
export async function archiveLeadProperty(teamId: string, userId: string, id: string) {
    const result = await prisma.leadProperty.updateMany({
        where: { id, teamId, archivedAt: null },
        data: { archivedAt: new Date() },
    });
    if (result.count !== 1) throw new APIError("Property not found", 404, "NOT_FOUND");

    await AuditService.log(teamId, userId, "LEAD_PROPERTY_ARCHIVE", "LeadProperty", id, {});
}

// Saves a lead editor's changes (null removes a value). Only the keys are audited, never the values.
export async function updateLeadCustomFields(teamId: string, userId: string, leadId: string, patch: Record<string, unknown>) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { customFields: true } });
    if (!lead) throw new APIError("Lead not found", 404, "NOT_FOUND");

    const definitions: PropertyDefinition[] = (await listLeadProperties(teamId, true)).map((row) => ({
        key: row.key,
        type: row.type as PropertyDefinition["type"],
        options: (row.options as string[] | null) ?? null,
        archivedAt: row.archivedAt,
    }));
    const current = (lead.customFields as Record<string, unknown> | null) ?? {};
    const merged = applyCustomFieldsPatch(definitions, current, patch);
    if (!merged.ok) throw new APIError(merged.message, 400, "VALIDATION_ERROR");

    await prisma.lead.updateMany({
        where: { id: leadId, teamId },
        data: { customFields: merged.value as Prisma.InputJsonValue },
    });
    await AuditService.log(teamId, userId, "LEAD_PROPERTY_VALUES_UPDATE", "Lead", leadId, { keys: Object.keys(patch) });
    return merged.value;
}
