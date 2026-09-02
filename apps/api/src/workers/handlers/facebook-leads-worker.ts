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
const MAX_PAGES = 200; // safety cap against a runaway/malformed paging loop (5,000 items at the default page size of 25)

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

async function graphFetchUrl(url: string) {
    const res = await fetch(url);
    const json: any = await res.json();
    if (!res.ok) {
        throw new Error(json?.error?.message || `Facebook Graph API request failed (${res.status})`);
    }
    return json;
}

async function graphFetch(path: string, accessToken: string) {
    const url = `${GRAPH_BASE_URL}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
    return graphFetchUrl(url);
}

/** Follows Graph API cursor pagination (`paging.next`) until exhausted - both a
 * form's leads and a page's leadgen_forms only come back one page (default 25)
 * at a time. For leads specifically, the sync cursor advances past everything
 * seen this poll, so any lead left on an unfetched page would be skipped this
 * run AND every run after (the next poll's filter only asks for leads created
 * after the new cursor); for forms, any form past page 1 would simply never be
 * synced. Capped at MAX_PAGES as a guard against an unbounded loop on a
 * malformed/looping paging response. */
async function fetchAllPages<T>(initialPath: string, accessToken: string): Promise<T[]> {
    const items: T[] = [];
    let res = await graphFetch(initialPath, accessToken);
    items.push(...(res?.data || []));

    let pages = 1;
    while (res?.paging?.next) {
        if (pages >= MAX_PAGES) {
            // Throw rather than silently truncating: for leads specifically, the
            // caller advances the sync cursor to the max created_time seen, so a
            // silent truncation here would permanently skip every lead past the
            // cap the same way the missing-pagination bug (OPEN-130) did.
            throw new Error(`Graph API pagination exceeded ${MAX_PAGES} pages for ${initialPath} - aborting instead of silently truncating results`);
        }
        res = await graphFetchUrl(res.paging.next);
        items.push(...(res?.data || []));
        pages += 1;
    }

    return items;
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
        // Scoped by teamId here too, not just the findFirst lookup above - same
        // "scope the mutation, not just a pre-check" anti-pattern already fixed
        // under OPEN-99/109/110/118/120/121/122/123/127.
        const result = await prisma.lead.updateMany({
            where: { id: existing.id, teamId },
            data: {
                fullName: fullName || existing.fullName || undefined,
                company: company || existing.company || undefined,
                jobTitle: jobTitle || existing.jobTitle || undefined,
                phone: phone || existing.phone || undefined,
                source: existing.source || "FACEBOOK_LEADS",
            },
        });
        if (result.count === 0) return null;
        return prisma.lead.findUniqueOrThrow({ where: { id: existing.id } });
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
        const leads = await fetchAllPages<LeadgenLead>(`/${formId}/leads?fields=created_time,field_data${filtering}`, accessToken);

        let latestCreatedTime = cursor.lastCreatedTime;
        for (const lead of leads) {
            const created = new Date(lead.created_time);
            try {
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
            } catch (leadError) {
                // Don't let one bad lead abort the whole batch: the cursor below only
                // advances once, after this loop, so an uncaught throw here would
                // roll every already-processed lead in this batch back to unsynced -
                // upsertLeadFromFacebook and the leadActivity.create above aren't
                // idempotent against a from-scratch replay, so the next successful
                // poll would silently duplicate their LeadActivity rows.
                const leadMessage = leadError instanceof Error ? leadError.message : "Unknown error";
                logger.error(`[FacebookLeadsWorker] Failed processing lead ${lead.id} for form ${formId}:`, { error: leadMessage });
                continue;
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

            const forms = await fetchAllPages<LeadgenForm>(`/${source.pageId}/leadgen_forms?fields=id,name`, accessToken);

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
