import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { classifyReply, summarizeOutcomes, type OutcomeRow } from "../modules/email-campaigner/service/copyOutcomes";

// npm run copy:outcomes -- [--team <id>] [--days N]
//
// Read-only. Sent emails written by the composer, grouped by prompt version, critic and switches, with
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

    // Latest classification per inbound message, read in chunks so a large window stays a small query.
    const messageIds = [...new Set(rows.flatMap((r) => r.events.map((e) => e.message?.id).filter((id): id is string => Boolean(id))))];
    const byMessage = new Map<string, string>();
    for (let i = 0; i < messageIds.length; i += 1000) {
        const trackers = await prisma.replyTracker.findMany({
            where: { emailId: { in: messageIds.slice(i, i + 1000) } },
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
    const groups = summarizeOutcomes(outcomeRows);
    console.log(`Emails with provenance in the last ${days} days${team ? ` for team ${team}` : ""}: ${rows.length}${rows.length === 50000 ? " (capped)" : ""}.`);
    for (const g of groups) {
        const pct = (n: number) => `${((100 * n) / g.sent).toFixed(1)}%`;
        console.log(`${g.key}\n  sent ${g.sent}, opened ${g.opened} (${pct(g.opened)}), replied ${g.replied} (${pct(g.replied)}), interested ${g.interested} (${pct(g.interested)}), negative ${g.negative} (${pct(g.negative)})`);
    }
    console.log("Interested and negative come from the reply classification; a suggestion a rep has not reviewed yet still counts.");
    if (groups.length === 0) console.log("Nothing yet: provenance is saved only for emails written after it shipped.");
}

main()
    .catch((error) => {
        console.error(error?.message || error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
