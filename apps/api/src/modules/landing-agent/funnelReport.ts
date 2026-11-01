// Pure stage maths and date-range rules for the landing page funnel report. No DB, no network.
// The SQL in funnelReportService.ts only counts and takes medians; everything the report shows
// about conversion and range limits is decided here.

export const FUNNEL_DEFAULT_RANGE_DAYS = 30;
export const FUNNEL_MAX_RANGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FunnelRangeResult = { ok: true; from: Date; to: Date } | { ok: false; reason: "invalid_range" | "range_too_long" };

// `to` defaults to now and `from` to 30 days before `to`. Ranges are capped at 90 days so the
// report's queries stay bounded, and an end date in the future is refused.
export function parseFunnelRange(input: { from?: string; to?: string }, now: Date): FunnelRangeResult {
    const to = input.to ? new Date(input.to) : now;
    const from = input.from ? new Date(input.from) : new Date(to.getTime() - FUNNEL_DEFAULT_RANGE_DAYS * DAY_MS);
    if (Number.isNaN(to.getTime()) || Number.isNaN(from.getTime())) return { ok: false, reason: "invalid_range" };
    if (to.getTime() <= from.getTime() || to.getTime() > now.getTime()) return { ok: false, reason: "invalid_range" };
    if (to.getTime() - from.getTime() > FUNNEL_MAX_RANGE_DAYS * DAY_MS) return { ok: false, reason: "range_too_long" };
    return { ok: true, from, to };
}

export interface FunnelStageCount {
    key: string;
    label: string;
    count: number;
}

export interface FunnelStep extends FunnelStageCount {
    // Share of the previous step that did not reach this one, in percent (one decimal place).
    // Null for the first step, or when the previous step is zero. Counts are never clamped, so a
    // later step can be larger than the one before; that shows up as a negative drop-off.
    dropOffPercent: number | null;
}

export function buildFunnelSteps(stages: FunnelStageCount[]): FunnelStep[] {
    return stages.map((stage, index) => {
        const previous = index === 0 ? 0 : stages[index - 1].count;
        if (index === 0 || previous <= 0) return { ...stage, dropOffPercent: null };
        return { ...stage, dropOffPercent: Math.round((1 - stage.count / previous) * 1000) / 10 };
    });
}
