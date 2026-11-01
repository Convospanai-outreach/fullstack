// Landing page funnel report (phase 12). One aggregate SQL query: counts and medians are computed in Postgres,
// so no event or lead row is loaded into memory. Every query is scoped by teamId and by the range (max 90 days).
//
// Data sources (no schema change):
// - visit / form start / CTA anchor click: LandingEvent, grouped per session (or per event when a visit has no session).
// - lead: LandingLead. It has no link to the CRM Lead, so the Lead is matched by email (lower-cased, same team), the
//   way the intake worker stores it. A lead merged in by a social link is matched the same way.
// - first contact, reply, meeting, won, qualified: Email (createdAt, repliedAt), Meeting (createdAt), Lead (hotAt, wonAt).
//   Only rows at or after the sign-up count, so a lead that already existed before the page is not credited to it.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError } from "@/lib/apiResponse";
import { assembleFunnelReport, type FunnelQueryRow, type FunnelReport } from "./funnelReport";

export interface FunnelReportInput {
    teamId: string;
    range: { from: Date; to: Date };
    landingPageId?: string;
    variantId?: string;
}

export async function getFunnelReport(input: FunnelReportInput): Promise<FunnelReport & { range: { from: Date; to: Date }; filters: { landingPageId: string | null; variantId: string | null } }> {
    const { teamId, range, landingPageId, variantId } = input;

    if (landingPageId) {
        const page = await prisma.landingPage.findFirst({ where: { id: landingPageId, teamId }, select: { id: true } });
        if (!page) throw new APIError("Landing page not found", 404, "NOT_FOUND");
    }

    const eventPageFilter = landingPageId ? Prisma.sql`AND e."landingPageId" = ${landingPageId}` : Prisma.empty;
    const eventVariantFilter = variantId ? Prisma.sql`AND e."variantId" = ${variantId}` : Prisma.empty;
    const leadPageFilter = landingPageId ? Prisma.sql`AND ll."landingPageId" = ${landingPageId}` : Prisma.empty;
    const leadVariantFilter = variantId ? Prisma.sql`AND ll."variantId" = ${variantId}` : Prisma.empty;

    const [row] = await prisma.$queryRaw<FunnelQueryRow[]>(Prisma.sql`
        WITH sessions AS (
            SELECT COALESCE(e."sessionId", e.id) AS key,
                   MIN(e."createdAt") FILTER (WHERE e."eventName" = 'page_view') AS visit_at,
                   MIN(e."createdAt") FILTER (WHERE e."eventName" = 'form_start') AS form_at,
                   MIN(e."createdAt") FILTER (WHERE e."eventName" = 'cta_click' AND e."eventData"->>'cta' = 'anchor') AS cta_at
            FROM "LandingEvent" e
            WHERE e."teamId" = ${teamId}
              AND e."createdAt" >= ${range.from} AND e."createdAt" < ${range.to}
              AND e."eventName" IN ('page_view', 'form_start', 'cta_click')
              ${eventPageFilter} ${eventVariantFilter}
            GROUP BY 1
        ),
        leads AS (
            SELECT ll.id,
                   ll."createdAt" AS lead_at,
                   s.visit_at, s.form_at, s.cta_at,
                   mail.contact_at, mail.reply_at,
                   meet.meeting_at,
                   hl.qualified_at, hl.won_at
            FROM "LandingLead" ll
            LEFT JOIN sessions s ON s.key = ll."sessionId"
            LEFT JOIN LATERAL (
                SELECT MIN(em."createdAt") AS contact_at, MIN(em."repliedAt") AS reply_at
                FROM "Email" em
                JOIN "Lead" l ON l.id = em."leadId"
                WHERE l."teamId" = ll."teamId" AND l.email = lower(trim(ll.email)) AND em."createdAt" >= ll."createdAt"
            ) mail ON true
            LEFT JOIN LATERAL (
                SELECT MIN(m."createdAt") AS meeting_at
                FROM "Meeting" m
                JOIN "Lead" l ON l.id = m."leadId"
                WHERE m."teamId" = ll."teamId" AND l.email = lower(trim(ll.email)) AND m."createdAt" >= ll."createdAt"
            ) meet ON true
            LEFT JOIN LATERAL (
                SELECT MIN(l."hotAt") FILTER (WHERE l."hotAt" >= ll."createdAt") AS qualified_at,
                       MIN(l."wonAt") FILTER (WHERE l."wonAt" >= ll."createdAt") AS won_at
                FROM "Lead" l
                WHERE l."teamId" = ll."teamId" AND l.email = lower(trim(ll.email))
            ) hl ON true
            WHERE ll."teamId" = ${teamId}
              AND ll."createdAt" >= ${range.from} AND ll."createdAt" < ${range.to}
              ${leadPageFilter} ${leadVariantFilter}
        )
        SELECT
            (SELECT COUNT(*)::int FROM sessions WHERE visit_at IS NOT NULL) AS visits,
            (SELECT COUNT(*)::int FROM sessions WHERE form_at IS NOT NULL) AS form_starts,
            (SELECT COUNT(*)::int FROM sessions WHERE cta_at IS NOT NULL) AS cta_clicks,
            (SELECT COUNT(*)::int FROM leads) AS leads,
            (SELECT COUNT(contact_at)::int FROM leads) AS contacted,
            (SELECT COUNT(reply_at)::int FROM leads) AS replied,
            (SELECT COUNT(meeting_at)::int FROM leads) AS meetings,
            (SELECT COUNT(won_at)::int FROM leads) AS won,
            (SELECT COUNT(qualified_at)::int FROM leads) AS qualified,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (form_at - visit_at))::float8)
               FROM sessions WHERE visit_at IS NOT NULL AND form_at >= visit_at) AS median_visit_to_form,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (lead_at - form_at))::float8)
               FROM leads WHERE form_at IS NOT NULL AND lead_at >= form_at) AS median_form_to_lead,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (contact_at - lead_at))::float8)
               FROM leads WHERE contact_at IS NOT NULL) AS median_lead_to_contact,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (reply_at - contact_at))::float8)
               FROM leads WHERE contact_at IS NOT NULL AND reply_at >= contact_at) AS median_contact_to_reply,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (meeting_at - reply_at))::float8)
               FROM leads WHERE reply_at IS NOT NULL AND meeting_at >= reply_at) AS median_reply_to_meeting,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (won_at - meeting_at))::float8)
               FROM leads WHERE meeting_at IS NOT NULL AND won_at >= meeting_at) AS median_meeting_to_won,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (qualified_at - lead_at))::float8)
               FROM leads WHERE qualified_at IS NOT NULL) AS median_lead_to_qualified
    `);

    // The Instagram step is team-wide: a keyword reply has no link to a page or variant that a query could use.
    const instagramRepliesSent = landingPageId || variantId
        ? null
        : await prisma.keywordTriggerReply.count({ where: { teamId, status: "SENT", createdAt: { gte: range.from, lt: range.to } } });

    return {
        ...assembleFunnelReport(row, instagramRepliesSent === null ? null : { repliesSent: instagramRepliesSent }),
        range,
        filters: { landingPageId: landingPageId ?? null, variantId: variantId ?? null },
    };
}
