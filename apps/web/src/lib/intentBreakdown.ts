// Mirrors the weights in apps/api LeadScoringService so the lead card can explain a score.
// Weights: dwell time 40%, email clicks 35%, social mentions 25%. Each input is capped at its max.
export const INTENT_FACTORS = [
    { key: "dwellTimeMinutes", label: "Dwell time", weight: 0.4, max: 20, unit: "min" },
    { key: "emailClicks", label: "Click-through", weight: 0.35, max: 20, unit: "clicks" },
    { key: "socialMentions", label: "Social", weight: 0.25, max: 10, unit: "mentions" },
] as const;

export interface IntentInputs {
    dwellTimeMinutes?: number | null | undefined;
    emailClicks?: number | null | undefined;
    socialMentions?: number | null | undefined;
}

export function intentTier(score: number | null | undefined): "HOT" | "WARM" | "COLD" {
    const s = score ?? 0;
    return s >= 0.7 ? "HOT" : s >= 0.4 ? "WARM" : "COLD";
}

/** One line per factor: "Dwell time: 4 min of 20 (+8 points of 40)". */
export function intentBreakdownLines(inputs: IntentInputs): string[] {
    return INTENT_FACTORS.map((f) => {
        const raw = Math.max(0, Number(inputs[f.key] ?? 0) || 0);
        const points = Math.round(Math.min(raw / f.max, 1) * f.weight * 100);
        return `${f.label}: ${Math.round(raw * 10) / 10} ${f.unit} (+${points} of ${Math.round(f.weight * 100)} points)`;
    });
}
