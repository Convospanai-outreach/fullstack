import type { DraftFactors } from "@/lib/ai/jev";

// Turns Jev's factor judgments (0 to 1, the chance a factor is strongly present) into the scores of
// the conversion strategies a campaign follows. The judgments are Jev's; the arithmetic and the
// thresholds here are code. Scores advise and never block a send.

export const SCORE_STRATEGIES = ["S7", "S8", "S12"] as const;
export type ScoreStrategy = (typeof SCORE_STRATEGIES)[number];

export interface DraftScore {
    strategyId: ScoreStrategy;
    name: string;
    score: number;
    // Set where a pass mark exists (S7).
    viable?: boolean;
    notes: string[];
}

const round2 = (n: number) => Number(n.toFixed(2));
const onFive = (p: number) => round2(1 + 4 * p);
const onTen = (p: number) => round2(1 + 9 * p);

// Motivation, clarity, incentive, friction and anxiety on 1 to 5. 15 or more is viable.
function conversionProbability(f: DraftFactors): DraftScore {
    const score = 4 * onFive(f.motivation) + 2 * onFive(f.valueClarity) + 2 * (onFive(f.incentive) - onFive(f.friction)) - 2 * onFive(f.anxiety);
    const notes: string[] = [];
    if (f.motivation < 0.5) notes.push("It does not tie to something the reader already wants. Open on their problem.");
    if (f.friction > 0.5) notes.push("Acting on it takes effort. Ask for something the reader can do in a few words.");
    if (f.anxiety > 0.5) notes.push("Something may make the reader hesitate. Make claims specific and remove pressure.");
    return { strategyId: "S7", name: "Conversion probability", score: round2(score), viable: score >= 15, notes };
}

// Value, relevance, clarity, urgency, anxiety and distraction on 1 to 10.
function sixFactor(f: DraftFactors): DraftScore {
    const value = onTen(f.incentive);
    const relevance = onTen(f.relevance);
    const clarity = onTen(f.valueClarity);
    const urgency = onTen(f.urgency);
    const anxiety = onTen(f.anxiety);
    const distraction = onTen(f.distraction);
    const score = value * 1.5 + relevance + clarity + urgency - anxiety * 1.2 - distraction * 1.2;
    const notes: string[] = [];
    if (clarity < 7) notes.push("Clarity: make the offer and the ask readable in one pass.");
    if (distraction > 4) notes.push("Distraction: cut extra links, asks and side topics.");
    if (anxiety > 4) notes.push("Anxiety: add a guarantee, a clear price or a real example.");
    return { strategyId: "S8", name: "Six-factor diagnostic", score: round2(score), notes };
}

// (dream outcome x likelihood) / (time delay x effort), each 1 to 10. Effort is the draft's friction.
function valueEquation(f: DraftFactors): DraftScore {
    const dream = onTen(f.dreamOutcome);
    const likelihood = onTen(f.likelihood);
    const delay = onTen(f.timeDelay);
    const effort = onTen(f.friction);
    const score = (dream * likelihood) / Math.max(1, delay * effort);
    const notes: string[] = [];
    if (delay > 4) notes.push("Slow payoff: show a quick first win.");
    if (effort > 4) notes.push("High effort for the reader: offer to do the first step for them.");
    if (likelihood < 7) notes.push("Weak proof: add a short real example or result.");
    return { strategyId: "S12", name: "Value equation", score: round2(score), notes };
}

const SCORERS: Record<ScoreStrategy, (f: DraftFactors) => DraftScore> = {
    S7: conversionProbability,
    S8: sixFactor,
    S12: valueEquation,
};

export function scoreStrategiesIn(strategyIds: readonly string[]): ScoreStrategy[] {
    return SCORE_STRATEGIES.filter((id) => strategyIds.includes(id));
}

export function scoreDraft(factors: DraftFactors, strategies: readonly ScoreStrategy[]): DraftScore[] {
    return strategies.map((id) => SCORERS[id](factors));
}
