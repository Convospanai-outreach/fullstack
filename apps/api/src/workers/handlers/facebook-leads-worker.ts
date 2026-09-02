import crypto from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { decryptCredential } from "@/lib/security/credentialVault";

// Polls Facebook/Instagram Lead Ads on an interval (no Zapier, no realtime webhook -
// per the user's explicit ask, a ~5h poll is fine). The Meta pixel plays no part in
// this: Lead Ads leads only come from the Graph API's leadgen_forms/leads endpoints,
// authenticated with each connected Page's access token (see facebookLeadsService.ts
// in apps/web, which owns the OAuth connect flow that populates FacebookLeadSource).
const GRAPH_API_VERSION = "v21.0"; // keep in sync with apps/web's facebookLeadsService.ts
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes - one form's leads page is fast; generous headroom for API slowness

interface LeadgenForm {
    id: string;
    name?: string;
}

interface LeadField {
    name: string;
    values: string[];
}

interface LeadgenLead {
    id: string;
    created_time: string;
    field_data: LeadField[];
}

function fieldValue(fields: LeadField[], ...names: string[]): string | undefined {
    for (const name of names) {
        const match = fields.find((f) => f.name.toLowerCase() === name);
        if (match?.values?.[0]) return match.values[0];
    }
    return undefined;
}

async function graphFetch(path: string, accessToken: string) {
    const url = `${GRAPH_BASE_URL}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json: any = await res.json();
    if (!res.ok) {
        throw new Error(json?.error?.message || `Facebook Graph API request failed (${res.status})`);
    }
    return json;
}

/** Create-or-update a Lead by email (falling back to phone), mirroring the same
 * dedupe pattern as landing-lead-intake-worker.ts. */
async function upsertLeadFromFacebook(teamId: string, fields: LeadField[]) {
    const email = fieldValue(fields, "email")?.trim().toLowerCase() || undefined;
    const phone = fieldValue(fields, "phone_number", "phone")?.trim() || undefined;
    const fullName = fieldValue(fields, "full_name", "name") || undefined;
    const company = fieldValue(fields, "company_name", "company") || undefined;
    const jobTitle = fieldValue(fields, "job_title") || undefined;

    if (!email && !phone) return null;

    const existing = await prisma.lead.findFirst({
        where: { teamId, OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any[] },
    });

    if (existing) {
        return prisma.lead.update({
            where: { id: existing.id },
            data: {
                fullName: fullName || existing.fullName || undefined,
                company: company || existing.company || undefined,
                jobTitle: jobTitle || existing.jobTitle || undefined,
                phone: phone || existing.phone || undefined,
                source: existing.source || "FACEBOOK_LEADS",
            },
        });
    }

    return prisma.lead.create({
        data: { teamId, email, phone, fullName, company, jobTitle, source: "FACEBOOK_LEADS", status: "NEW" },
    });
}

async function syncForm(teamId: string, sourceId: string, formId: string, accessToken: string) {
    const cursor = await prisma.facebookLeadSyncCursor.upsert({
        where: { sourceId_formId: { sourceId, formId } },
        create: { teamId, sourceId, formId },
        update: {},
    });

    const now = new Date();
    const lockToken = crypto.randomUUID();
    const lockExpiresAt = new Date(now.getTime() + LOCK_DURATION_MS);
    const claimed = await prisma.facebookLeadSyncCursor.updateMany({
        where: {
            id: cursor.id,
            OR: [{ lockToken: null }, { lockExpiresAt: { lte: now } }],
        },
        data: { lockToken, lockedAt: now, lockExpiresAt, status: "RUNNING" },
    });
    if (claimed.count === 0) return { formId, synced: 0, skipped: "locked" as const };

    try {
        const since = cursor.lastCreatedTime ? Math.floor(cursor.lastCreatedTime.getTime() / 1000) : undefined;
        const filtering = since
            ? `&filtering=${encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]))}`
            : "";
        const leadsRes = await graphFetch(`/${formId}/leads?fields=created_time,field_data${filtering}`, accessToken);
        const leads: LeadgenLead[] = leadsRes?.data || [];

        let latestCreatedTime = cursor.lastCreatedTime;
        for (const lead of leads) {
            const created = new Date(lead.created_time);
            const upserted = await upsertLeadFromFacebook(teamId, lead.field_data || []);
            if (upserted) {
                await prisma.leadActivity.create({
                    data: {
                        leadId: upserted.id,
                        channel: "FACEBOOK_LEADS",
                        type: "LEAD_CAPTURED",
                        title: "Captured from Facebook/Instagram Lead Ad",
                        metadata: { formId, facebookLeadId: lead.id },
                    },
                }).catch(() => undefined);
            }
            if (!latestCreatedTime || created > latestCreatedTime) latestCreatedTime = created;
        }

        await prisma.facebookLeadSyncCursor.update({
            where: { id: cursor.id },
            data: {
                lastCreatedTime: latestCreatedTime,
                status: "IDLE",
                consecutiveFailures: 0,
                lastError: null,
                lockToken: null,
                lockedAt: null,
                lockExpiresAt: null,
            },
        });

        return { formId, synced: leads.length };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await prisma.facebookLeadSyncCursor.update({
            where: { id: cursor.id },
            data: {
                status: "ERROR",
                consecutiveFailures: { increment: 1 },
                lastError: message,
                lockToken: null,
                lockedAt: null,
                lockExpiresAt: null,
            },
        }).catch(() => undefined);
        logger.error(`[FacebookLeadsWorker] Sync failed for form ${formId} (source ${sourceId}):`, { error: message });
        return { formId, synced: 0, error: message };
    }
}

export async function syncDueFacebookLeadSources(limit = 25) {
    const sources = await prisma.facebookLeadSource.findMany({
        where: { isActive: true },
        take: limit,
    });

    const results = [];
    for (const source of sources) {
        try {
            const accessToken = await decryptCredential(source.encryptedPageAccessToken as any);
            if (!accessToken) {
                results.push({ sourceId: source.id, error: "no_access_token" });
                continue;
            }

            const formsRes = await graphFetch(`/${source.pageId}/leadgen_forms?fields=id,name`, accessToken);
            const forms: LeadgenForm[] = formsRes?.data || [];

            for (const form of forms) {
                const result = await syncForm(source.teamId, source.id, form.id, accessToken);
                results.push({ sourceId: source.id, ...result });
            }

            if (source.lastError) {
                await prisma.facebookLeadSource.update({ where: { id: source.id }, data: { lastError: null } });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await prisma.facebookLeadSource.update({ where: { id: source.id }, data: { lastError: message } }).catch(() => undefined);
            logger.error(`[FacebookLeadsWorker] Sync failed for page ${source.pageId} (team ${source.teamId}):`, { error: message });
            results.push({ sourceId: source.id, error: message });
        }
    }

    return results;
}
