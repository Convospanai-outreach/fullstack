import { intentBreakdownLines, intentTier, type IntentInputs } from "@/lib/intentBreakdown";

const TIER_CLASS = {
    HOT: "text-destructive border-destructive/25 bg-destructive/5",
    WARM: "text-warning border-warning/25 bg-warning/5",
    COLD: "text-primary border-primary/25 bg-primary/5",
} as const;

// Intent badge with the three weighted inputs in its tooltip. The score is computed in the cloud from
// engagement, so the tooltip says so rather than claiming an edge source.
export function IntentBadge({ intentScore, ...inputs }: IntentInputs & { intentScore: number | null | undefined }) {
    const tier = intentTier(intentScore);
    const title = [...intentBreakdownLines(inputs), "Computed from engagement in the cloud"].join("\n");
    return (
        <span
            title={title}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider ${TIER_CLASS[tier]}`}
        >
            {tier} · {Math.round((intentScore ?? 0) * 100)}%
        </span>
    );
}
