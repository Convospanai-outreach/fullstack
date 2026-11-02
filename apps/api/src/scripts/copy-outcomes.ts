import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { classifyReply, linkedinOutcomeRows, summarizeOutcomes, type OutcomeRow } from "../modules/email-campaigner/service/copyOutcomes";

// npm run copy:outcomes -- [--team <id>] [--days N]
//
// Read-only. Sent emails written by the composer or the older draft path, and LinkedIn messages, grouped by prompt version, critic and switches, with
// how many were opened and replied to. Run by an operator with database access, so it can span teams:
// pass --team to look at one. Replies are split by classification: an email is joined to its
// reply through the reply event (EmailEvent.emailId -> Message -> ReplyTracker.emailId).

function flag(name: string) {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? undefined : process.argv[i + 1] ?? "";
}

async function main() {
    const team = flag("team");
    const days = flag("days") !== undefined ? Number(flag("days")) : 30;
    if (!(days > 0)) throw new Error("--days must be a positive number.");

    const rows = await prisma.email.findMany({
        where: {
            copyProvenance: { not: Prisma.DbNull },
            createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
            ...(team ? { campaign: { teamId: team } } : {}),
        },
        select: {
            copyProvenance: true,
            openedAt: true,
            repliedAt: true,
            events: { where: { message: { isNot: null } }, select: { message: { select: { id: true } } } },
        },
        take: 50000,
    });

    const messageIds = [...new Set(rows.flatMap((r) => r.events.map((e) => e.message?.id).filter((id): id is string => Boolean(id))))];

    // LinkedIn messages we sent with provenance, and the lead's inbound LinkedIn messages after them.
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sentLinkedIn = await prisma.message.findMany({
        where: {
            platform: "LINKEDIN", direction: "OUTBOUND", copyProvenance: { not: Prisma.DbNull }, createdAt: { gte: since },
            ...(team ? { lead: { teamId: team } } : {}),
        },
        select: { leadId: true, createdAt: true, copyProvenance: true },
        take: 50000,
    });
    const leadIds = [...new Set(sentLinkedIn.map((m) => m.leadId))];
    const repliesLinkedIn: { id: string; leadId: string; createdAt: Date }[] = [];
    for (let i = 0; i < leadIds.length; i += 1000) {
        repliesLinkedIn.push(...(await prisma.message.findMany({
            where: { platform: "LINKEDIN", direction: "INBOUND", leadId: { in: leadIds.slice(i, i + 1000) }, createdAt: { gte: since } },
            select: { id: true, leadId: true, createdAt: true },
        })));
    }

    // Classification per inbound message (the latest tracker wins), read in chunks.
    const allIds = [...messageIds, ...repliesLinkedIn.map((r) => r.id)];
    const byMessage = new Map<string, string>();
    for (let i = 0; i < allIds.length; i += 1000) {
        const trackers = await prisma.replyTracker.findMany({
            where: { emailId: { in: allIds.slice(i, i + 1000) } },
            orderBy: { receivedAt: "asc" },
            select: { emailId: true, aiClassification: true, humanCorrection: true },
        });
        for (const t of trackers) if (t.emailId) byMessage.set(t.emailId, classifyReply(t));
    }
    const outcomeRows: OutcomeRow[] = rows.map((r) => ({
        copyProvenance: r.copyProvenance,
        openedAt: r.openedAt,
        repliedAt: r.repliedAt,
        classification: r.events.map((e) => (e.message ? byMessage.get(e.message.id) : undefined)).find(Boolean) ?? null,
    }));
    const groups = summarizeOutcomes([...outcomeRows, ...linkedinOutcomeRows(sentLinkedIn, repliesLinkedIn, byMessage)]);
    console.log(`Emails with provenance in the last ${days} days${team ? ` for team ${team}` : ""}: ${rows.length}${rows.length === 50000 ? " (capped)" : ""}; LinkedIn messages: ${sentLinkedIn.length}.`);
    for (const g of groups) {
        const pct = (n: number) => `${((100 * n) / g.sent).toFixed(1)}%`;
        console.log(`${g.key}\n  sent ${g.sent}, opened ${g.opened} (${pct(g.opened)}), replied ${g.replied} (${pct(g.replied)}), interested ${g.interested} (${pct(g.interested)}), negative ${g.negative} (${pct(g.negative)})`);
    }
    console.log("LinkedIn replies are matched to the next inbound message from the same lead, and opens are not known. Interested and negative come from the reply classification; a suggestion a rep has not reviewed yet still counts.");
    if (groups.length === 0) console.log("Nothing yet: provenance is saved only for emails written after it shipped.");
}

main()
    .catch((error) => {
        console.error(error?.message || error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
