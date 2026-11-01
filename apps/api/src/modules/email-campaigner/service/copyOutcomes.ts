import { readProvenance } from "./copyProvenance";

// Groups sent emails by what wrote them and counts what happened next. Pure, so the script that
// reads the rows stays thin. Counts only. A reply is split into interested and negative from its
// classification: the rep's correction when there is one, otherwise the AI's suggestion (which may
// not have been reviewed yet). Questions and out-of-office replies count as replies only.

export interface OutcomeRow {
    copyProvenance: unknown;
    openedAt: Date | null;
    repliedAt: Date | null;
    // The reply's classification (see classifyReply), when one was recorded.
    classification?: string | null;
}

export interface OutcomeGroup {
    key: string;
    sent: number;
    opened: number;
    replied: number;
    interested: number;
    negative: number;
}

export interface TrackedReply {
    aiClassification: string;
    humanCorrection: string | null;
}

// A rep's correction wins over the AI's suggestion.
export function classifyReply(reply: TrackedReply): string {
    return (reply.humanCorrection || reply.aiClassification).toUpperCase();
}

const NEGATIVE = new Set(["NOT_INTERESTED", "DNC"]);

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
        const group = groups.get(key) ?? { key, sent: 0, opened: 0, replied: 0, interested: 0, negative: 0 };
        group.sent++;
        if (row.openedAt) group.opened++;
        if (row.repliedAt) group.replied++;
        if (row.classification === "INTERESTED") group.interested++;
        else if (row.classification && NEGATIVE.has(row.classification)) group.negative++;
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.sent - a.sent);
}
