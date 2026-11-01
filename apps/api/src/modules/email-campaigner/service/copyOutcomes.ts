import { readProvenance } from "./copyProvenance";

// Groups sent emails by what wrote them and counts what happened next. Pure, so the script that
// reads the rows stays thin. Counts only: a reply is the strongest signal a row carries, and it says
// nothing about whether the reply was positive (classification is stored against the inbound
// message, not the email, so it is not joined here).

export interface OutcomeRow {
    copyProvenance: unknown;
    openedAt: Date | null;
    repliedAt: Date | null;
}

export interface OutcomeGroup {
    key: string;
    sent: number;
    opened: number;
    replied: number;
}

export function provenanceKey(p: NonNullable<ReturnType<typeof readProvenance>>): string {
    const flags = Object.entries(p.flags).filter(([, on]) => on).map(([name]) => name);
    return `${p.prompts.draft} | critic ${p.prompts.critique} | ${p.critique} | flags: ${flags.join("+") || "none"}`;
}

export function summarizeOutcomes(rows: OutcomeRow[]): OutcomeGroup[] {
    const groups = new Map<string, OutcomeGroup>();
    for (const row of rows) {
        const provenance = readProvenance(row.copyProvenance);
        if (!provenance) continue;
        const key = provenanceKey(provenance);
        const group = groups.get(key) ?? { key, sent: 0, opened: 0, replied: 0 };
        group.sent++;
        if (row.openedAt) group.opened++;
        if (row.repliedAt) group.replied++;
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.sent - a.sent);
}
