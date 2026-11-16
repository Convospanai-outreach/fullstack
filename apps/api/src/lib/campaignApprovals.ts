import { Prisma, type PrismaClient } from "@prisma/client";

// Which approval requests belong to a campaign, decided in the database. Requests are stored
// against different things: the campaign itself, a lead, "leadId:channel" for a held AI message,
// or an email id with the campaign and lead in the payload. This is the one place that knows all four:
//   1. payload.campaignId is the campaign, or
//   2. the request is about the Campaign itself (entityId is the campaign), or
//   3. otherwise its lead (payload.leadId when a string, else the entityId before ":") is in the campaign.
// Supported by the expression indexes on ApprovalRequest from migration 20261115100000-20261115100200.
export async function findCampaignApprovalIds(
    db: Pick<PrismaClient, "$queryRaw">,
    teamId: string,
    campaignId: string,
    opts: { status?: string; limit?: number } = {},
): Promise<string[]> {
    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT a."id" FROM "ApprovalRequest" a
        WHERE a."teamId" = ${teamId}
          AND (${opts.status ?? null}::text IS NULL OR a."status" = ${opts.status ?? null}::text)
          AND (
            a."payload"->>'campaignId' = ${campaignId}
            OR (a."entityType" = 'Campaign' AND a."entityId" = ${campaignId})
            OR (a."entityType" <> 'Campaign' AND (
                (jsonb_typeof(a."payload"->'leadId') = 'string' AND a."payload"->>'leadId' IN
                    (SELECT l."id" FROM "Lead" l WHERE l."campaignId" = ${campaignId} AND l."teamId" = ${teamId}))
                OR (jsonb_typeof(a."payload"->'leadId') IS DISTINCT FROM 'string' AND split_part(a."entityId", ':', 1) IN
                    (SELECT l."id" FROM "Lead" l WHERE l."campaignId" = ${campaignId} AND l."teamId" = ${teamId}))
            ))
          )
        ORDER BY a."createdAt" DESC
        LIMIT ${opts.limit ?? null}::bigint`);
    return rows.map((r) => r.id);
}
