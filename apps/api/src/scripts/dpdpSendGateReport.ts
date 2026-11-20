/**
 * DPDP send gate: how many leads per team WOULD be blocked if the gate were on. Read-only, writes nothing,
 * backfills nothing. Run it, look at the counts, then decide who to switch on.
 *
 *   npx tsx --tsconfig ./tsconfig.json src/scripts/dpdpSendGateReport.ts
 */
import { canContact, type ConsentRow } from "@/modules/governance/lawfulBasis";

const PAGE = 1000;

type Db = {
    team: { findMany: (args: any) => Promise<Array<{ id: string; name: string | null; sendSafety: unknown }>> };
    lead: { findMany: (args: any) => Promise<Array<{ id: string; lawfulBasis: any; sourceUrl: string | null; publishedBySubject: boolean }>> };
    consentLedger: { findMany: (args: any) => Promise<Array<ConsentRow & { leadId: string }>> };
};

export type TeamGateReport = { teamId: string; teamName: string | null; gateOn: boolean; leads: number; blockedEmail: number; blockedWhatsapp: number };

export async function buildSendGateReport(db: Db): Promise<TeamGateReport[]> {
    const teams = await db.team.findMany({ select: { id: true, name: true, sendSafety: true }, orderBy: { id: "asc" } });
    const report: TeamGateReport[] = [];

    for (const team of teams) {
        const settings = team.sendSafety && typeof team.sendSafety === "object" ? (team.sendSafety as Record<string, unknown>) : null;
        const row: TeamGateReport = { teamId: team.id, teamName: team.name, gateOn: settings?.["DPDP_SEND_GATE"] === true, leads: 0, blockedEmail: 0, blockedWhatsapp: 0 };

        let cursor: string | undefined;
        for (;;) {
            const leads = await db.lead.findMany({
                where: { teamId: team.id },
                select: { id: true, lawfulBasis: true, sourceUrl: true, publishedBySubject: true },
                orderBy: { id: "asc" },
                take: PAGE,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            });
            if (leads.length === 0) break;

            const rows = await db.consentLedger.findMany({
                where: { leadId: { in: leads.map((l) => l.id) } },
                select: { leadId: true, channel: true, status: true, revokedAt: true, grantedAt: true, purpose: true },
            });
            const byLead = new Map<string, Array<ConsentRow & { leadId: string }>>();
            for (const r of rows) byLead.set(r.leadId, [...(byLead.get(r.leadId) ?? []), r]);

            for (const lead of leads) {
                const ledger = byLead.get(lead.id) ?? [];
                row.leads += 1;
                if (!canContact(lead, "EMAIL", ledger)) row.blockedEmail += 1;
                if (!canContact(lead, "WHATSAPP", ledger)) row.blockedWhatsapp += 1;
            }
            cursor = leads[leads.length - 1]!.id;
            if (leads.length < PAGE) break;
        }
        report.push(row);
    }
    return report;
}

async function main() {
    const { prisma } = await import("@/lib/db");
    const report = await buildSendGateReport(prisma as unknown as Db);
    console.table(report);
    const total = report.reduce((n, r) => n + r.leads, 0);
    console.log(`${report.length} teams, ${total} leads. Read-only: nothing was changed.`);
    await prisma.$disconnect();
}

if (process.argv[1] && /dpdpSendGateReport\.(ts|js|mts)$/.test(process.argv[1])) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
