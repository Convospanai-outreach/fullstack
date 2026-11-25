import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSuperAdminActor } from "@/lib/superadmin/actor";
import { clientIp } from "@/lib/clientIp";
import { mailboxSendingHold } from "@/lib/email/mailboxReputationHold";

type Stats = { teamId: string; sent: number; bounced: number; complained: number; delayed: number; failed: number };

export async function GET() {
    if (!await getSuperAdminActor()) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [teams, stats, incidents] = await Promise.all([
        prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sendSafety: true } }),
        prisma.$queryRaw<Stats[]>`
            WITH delivery AS (
                SELECT e.id, c."teamId", e.status, e."bouncedAt",
                    BOOL_OR(ev.type IN ('BOUNCE', 'BOUNCED')) AS bounced,
                    BOOL_OR(ev.type = 'COMPLAINED') AS complained,
                    BOOL_OR(ev.type = 'DELIVERY_DELAYED') AS delayed,
                    BOOL_OR(ev.type = 'DELIVERY_FAILED') AS failed
                FROM "Email" e JOIN "Campaign" c ON c.id = e."campaignId"
                LEFT JOIN "EmailEvent" ev ON ev."emailId" = e.id AND ev."createdAt" >= ${since}
                WHERE (e."createdAt" >= ${since} AND e.status IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'unsubscribed', 'failed'))
                    OR EXISTS (SELECT 1 FROM "EmailEvent" s WHERE s."emailId" = e.id AND s.type = 'SENT' AND s."createdAt" >= ${since})
                GROUP BY e.id, c."teamId"
            )
            SELECT "teamId", COUNT(*)::int AS sent,
                (COUNT(*) FILTER (WHERE bounced OR "bouncedAt" >= ${since}))::int AS bounced,
                (COUNT(*) FILTER (WHERE complained))::int AS complained,
                (COUNT(*) FILTER (WHERE delayed))::int AS delayed,
                (COUNT(*) FILTER (WHERE failed OR status = 'failed'))::int AS failed
            FROM delivery GROUP BY "teamId"`,
        prisma.overseerNudge.groupBy({ by: ["teamId"], where: { nudgeType: "MAILBOX_REPUTATION", status: "OPEN" }, _count: { _all: true } }),
    ]);
    const byTeam = new Map(stats.map((row) => [row.teamId, row]));
    const incidentCounts = new Map(incidents.map((row) => [row.teamId, row._count._all]));
    return NextResponse.json({ teams: teams.map(({ id, name, sendSafety }) => {
        const row = byTeam.get(id);
        return {
            id, name, sent: row?.sent ?? 0, bounced: row?.bounced ?? 0, complained: row?.complained ?? 0, delayed: row?.delayed ?? 0,
            failed: row?.failed ?? 0, incidents: incidentCounts.get(id) ?? 0,
            held: mailboxSendingHold(null, sendSafety) === "TEAM_SENDING_HOLD",
        };
    }) });
}

const input = z.object({ teamId: z.string().min(1).max(128), held: z.boolean(), reason: z.string().trim().min(1).max(300) });

export async function PUT(request: Request) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A team, hold state and reason are required" }, { status: 400 });
    const { teamId, held, reason } = parsed.data;
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${"mailbox_reputation:" + teamId}, 0))`;
        const team = await tx.team.findUnique({ where: { id: teamId }, select: { sendSafety: true } });
        if (!team) return "missing";
        if ((mailboxSendingHold(null, team.sendSafety) === "TEAM_SENDING_HOLD") === held) return "unchanged";
        const state = JSON.stringify(held ? { since: now.toISOString(), reason, blocksReplies: true } : null);
        await tx.$executeRaw`
            UPDATE "Team" SET "sendSafety" = jsonb_set(
                CASE WHEN jsonb_typeof("sendSafety") = 'object' THEN "sendSafety" ELSE '{}'::jsonb END,
                '{reputation}',
                (CASE WHEN jsonb_typeof("sendSafety"->'reputation') = 'object' THEN "sendSafety"->'reputation' ELSE '{}'::jsonb END)
                    || jsonb_build_object('sendingHold', ${state}::jsonb)
            ), "updatedAt" = now()
            WHERE id = ${teamId}`;
        const action = held ? "TEAM_SENDING_HELD" : "TEAM_SENDING_RESUMED";
        await tx.auditLog.create({ data: { orgId: teamId, actorId: actor.id, action, entity: "MailboxReputation", entityId: teamId, metadata: { reason } } });
        await tx.superAdminAuditLog.create({ data: { userId: actor.id, action, ipAddress: clientIp(request.headers), metadata: { teamId, reason } } });
        const admins = await tx.teamMember.findMany({
            where: { teamId, status: "active", role: { in: ["owner", "OWNER", "admin", "ADMIN"] }, userId: { not: null } },
            select: { userId: true },
        });
        const message = held ? "Platform administrator placed a hold on team email sending." : "Platform administrator released the team email hold.";
        await tx.notification.createMany({ data: admins.flatMap(({ userId }) => userId ? [{
            userId, type: "system", message, meta: { teamId, href: "/settings/domain-health" },
        }] : []) });
        return "changed";
    });
    return result === "missing" ? NextResponse.json({ error: "Team not found" }, { status: 404 }) : NextResponse.json({ held });
}
