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

export function buildFunnelSteps<T extends FunnelStageCount>(stages: T[]): Array<T & { dropOffPercent: number | null }> {
    return stages.map((stage, index) => {
        const previous = index === 0 ? 0 : stages[index - 1].count;
        if (index === 0 || previous <= 0) return { ...stage, dropOffPercent: null };
        return { ...stage, dropOffPercent: Math.round((1 - stage.count / previous) * 1000) / 10 };
    });
}

// One row of the report query (funnelReportService.ts). Counts are integers; medians are seconds, or null
// when no lead or session had both timestamps of that step.
export interface FunnelQueryRow {
    visits: number;
    form_starts: number;
    cta_clicks: number;
    leads: number;
    contacted: number;
    replied: number;
    meetings: number;
    won: number;
    qualified: number;
    median_visit_to_form: number | null;
    median_form_to_lead: number | null;
    median_lead_to_contact: number | null;
    median_contact_to_reply: number | null;
    median_reply_to_meeting: number | null;
    median_meeting_to_won: number | null;
    median_lead_to_qualified: number | null;
}

export interface FunnelReport {
    // The chain. Each step's median is the time from the previous chain step, for those who reached both.
    steps: Array<FunnelStep & { medianSecondsFromPrevious: number | null }>;
    // Not chain steps: a CTA anchor click can come after the form has started (form-only pages), and a
    // HOT lead can come before or after first contact, so neither has a fixed place in the order.
    sideMetrics: { ctaClicks: number; qualified: number; medianSecondsLeadToQualified: number | null };
    // Team-wide keyword replies sent in the range. Only set when no page or variant filter applies.
    instagram: { repliesSent: number } | null;
}

export function assembleFunnelReport(row: FunnelQueryRow, instagram: { repliesSent: number } | null): FunnelReport {
    const chain: Array<FunnelStageCount & { medianSecondsFromPrevious: number | null }> = [
        { key: "visit", label: "Visit", count: row.visits, medianSecondsFromPrevious: null },
        { key: "form_start", label: "Form start", count: row.form_starts, medianSecondsFromPrevious: row.median_visit_to_form },
        { key: "lead", label: "Lead", count: row.leads, medianSecondsFromPrevious: row.median_form_to_lead },
        { key: "first_contact", label: "First contact", count: row.contacted, medianSecondsFromPrevious: row.median_lead_to_contact },
        { key: "reply", label: "Reply", count: row.replied, medianSecondsFromPrevious: row.median_contact_to_reply },
        { key: "meeting", label: "Meeting", count: row.meetings, medianSecondsFromPrevious: row.median_reply_to_meeting },
        { key: "won", label: "Won", count: row.won, medianSecondsFromPrevious: row.median_meeting_to_won },
    ];
    return {
        steps: buildFunnelSteps(chain),
        sideMetrics: { ctaClicks: row.cta_clicks, qualified: row.qualified, medianSecondsLeadToQualified: row.median_lead_to_qualified },
        instagram,
    };
}
