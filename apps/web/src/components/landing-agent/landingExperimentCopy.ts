// Plain-language text for the A/B test panel (phase 6B). Pure: no DOM, no network.
import type { ExperimentResults, ExperimentRow } from "@/modules/landing-agent/service/landingExperimentApi";

const STATUS_LABELS: Record<ExperimentRow["status"], string> = {
    draft: "Draft",
    running: "Running",
    paused: "Paused",
    ended: "Ended",
};

export function statusLabel(status: ExperimentRow["status"]): string {
    return STATUS_LABELS[status];
}

export function conversionText(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

// Confidence is rounded down, so the panel never claims more certainty than the test has.
export function verdictMessage(results: ExperimentResults): string {
    const { verdict, variants } = results;
    if (verdict.status === "not_enough_data") {
        if (verdict.readiness === "not_enough_days") {
            return "Not enough data yet. The test needs to run for 3 days.";
        }
        return `Not enough data yet. Each page needs at least 100 visitors (A has ${variants.A.visitors}, B has ${variants.B.visitors}).`;
    }
    const confidence = Math.floor(verdict.confidence);
    if (verdict.status === "no_clear_difference" || verdict.winner === null) {
        return `No clear winner yet. Confidence is ${confidence}%, and 95% is needed.`;
    }
    return `Variant ${verdict.winner} is ahead with ${confidence}% confidence. Choose it as the winner to keep it on the shared path.`;
}
