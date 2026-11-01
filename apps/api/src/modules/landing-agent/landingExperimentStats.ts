// Pure statistics for landing page A/B tests (phase 6B). No DB, no network.
// The UI and the results API both call these, so the numbers shown never depend on where they were computed.

export const MIN_VISITORS_PER_VARIANT = 100;
export const MIN_TEST_DAYS = 3;
export const WINNER_CONFIDENCE_PERCENT = 95;

const DAY_MS = 24 * 60 * 60 * 1000;

// erf via Abramowitz and Stegun 7.1.26 (absolute error below 1.5e-7).
function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign * (1 - poly * Math.exp(-ax * ax));
}

export interface ZTestInput {
    visitorsA: number;
    conversionsA: number;
    visitorsB: number;
    conversionsB: number;
}

export interface ZTestResult {
    rateA: number;
    rateB: number;
    pooledRate: number;
    // B minus A, as a rate (0.03 means 3 percentage points).
    difference: number;
    z: number;
    // Confidence in percent that B and A differ: 100 * (1 - two-sided p).
    confidence: number;
}

// Two-proportion z-test (pooled standard error), two-sided.
export function twoProportionZTest(input: ZTestInput): ZTestResult {
    const { visitorsA: nA, conversionsA: xA, visitorsB: nB, conversionsB: xB } = input;
    const rateA = nA > 0 ? xA / nA : 0;
    const rateB = nB > 0 ? xB / nB : 0;
    const pooledRate = nA + nB > 0 ? (xA + xB) / (nA + nB) : 0;
    const difference = rateB - rateA;
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * ((nA > 0 ? 1 / nA : 0) + (nB > 0 ? 1 / nB : 0)));
    // A variant with no visitors has no rate to compare, so no z-score (and no confidence) is reported.
    if (nA === 0 || nB === 0 || !(se > 0) || difference === 0) {
        return { rateA, rateB, pooledRate, difference, z: 0, confidence: 0 };
    }
    const z = difference / se;
    // Two-sided p = 1 - erf(|z| / sqrt(2)), so confidence = erf(|z| / sqrt(2)).
    const confidence = erf(Math.abs(z) / Math.SQRT2) * 100;
    return { rateA, rateB, pooledRate, difference, z, confidence };
}

export interface ReadinessInput {
    visitorsA: number;
    visitorsB: number;
    startedAt: Date;
    now: Date;
}

export type ReadinessReason = "ready" | "not_enough_visitors" | "not_enough_days";

export function experimentReadiness(input: ReadinessInput): { ready: boolean; reason: ReadinessReason } {
    if (input.visitorsA < MIN_VISITORS_PER_VARIANT || input.visitorsB < MIN_VISITORS_PER_VARIANT) {
        return { ready: false, reason: "not_enough_visitors" };
    }
    const elapsedDays = (input.now.getTime() - input.startedAt.getTime()) / DAY_MS;
    if (elapsedDays < MIN_TEST_DAYS) {
        return { ready: false, reason: "not_enough_days" };
    }
    return { ready: true, reason: "ready" };
}

export interface VerdictInput extends ZTestInput {
    startedAt: Date;
    now: Date;
}

export type ExperimentVerdict = ZTestResult & {
    status: "not_enough_data" | "no_clear_difference" | "clear_winner";
    winner: "A" | "B" | null;
    readiness: ReadinessReason;
};

// A winner is only named when the test is ready AND confidence reaches 95%. Never automatic: the caller shows it.
export function verdictFor(input: VerdictInput): ExperimentVerdict {
    const stats = twoProportionZTest(input);
    const readiness = experimentReadiness({
        visitorsA: input.visitorsA,
        visitorsB: input.visitorsB,
        startedAt: input.startedAt,
        now: input.now,
    });
    if (!readiness.ready) {
        return { ...stats, status: "not_enough_data", winner: null, readiness: readiness.reason };
    }
    if (stats.confidence < WINNER_CONFIDENCE_PERCENT || stats.difference === 0) {
        return { ...stats, status: "no_clear_difference", winner: null, readiness: readiness.reason };
    }
    return { ...stats, status: "clear_winner", winner: stats.difference > 0 ? "B" : "A", readiness: readiness.reason };
}
