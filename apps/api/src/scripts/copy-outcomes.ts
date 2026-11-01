import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { summarizeOutcomes } from "../modules/email-campaigner/service/copyOutcomes";

// npm run copy:outcomes -- [--team <id>] [--days N]
//
// Read-only. Sent emails written by the composer, grouped by prompt version, critic and switches, with
// how many were opened and replied to. Run by an operator with database access, so it can span teams:
// pass --team to look at one. Replies are not split into positive and negative here.

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
        select: { copyProvenance: true, openedAt: true, repliedAt: true },
        take: 50000,
    });

    const groups = summarizeOutcomes(rows);
    console.log(`Emails with provenance in the last ${days} days${team ? ` for team ${team}` : ""}: ${rows.length}${rows.length === 50000 ? " (capped)" : ""}.`);
    for (const g of groups) {
        const pct = (n: number) => `${((100 * n) / g.sent).toFixed(1)}%`;
        console.log(`${g.key}\n  sent ${g.sent}, opened ${g.opened} (${pct(g.opened)}), replied ${g.replied} (${pct(g.replied)})`);
    }
    if (groups.length === 0) console.log("Nothing yet: provenance is saved only for emails written after it shipped.");
}

main()
    .catch((error) => {
        console.error(error?.message || error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
