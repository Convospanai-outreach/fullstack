import { PACE_LIMITS, type PaceLimits } from "./paceRules";

// The strategies a campaign can follow. This file holds only what the app shows and uses: an id, a
// name, a one-line summary, and the guidance a strategy gives for the campaign's objective, ICP and
// pacing. The detailed method behind each strategy is not kept here.
//
// A strategy is selectable (`live`) only once something in the app acts on it. The rest are listed
// so the roadmap is visible, but cannot be stored on a campaign.

export type StrategyGroup = "approach" | "check" | "lens";

export const STRATEGY_GROUP_LABELS: Record<StrategyGroup, { title: string; hint: string }> = {
    approach: { title: "Approach", hint: "Sets the campaign's objective, the audience it suits and its pacing." },
    check: { title: "Checks", hint: "Reviews a draft or setup before it goes out." },
    lens: { title: "Copy lenses", hint: "Shapes how an email is written." },
};

export interface Strategy {
    id: string;
    name: string;
    summary: string;
    group: StrategyGroup;
    // Selectable now. False means the strategy is planned and has no effect yet.
    live: boolean;
    // Shown when it is chosen. Both may be edited by the user afterwards.
    objective?: string;
    icp?: string;
    // Overrides of the default pace limits while this strategy is on the campaign.
    pace?: Partial<PaceLimits>;
    // What the strategy changes once live, in plain words.
    effect?: string;
}

// Strategy 2 (abandonment and replenishment) is left out on purpose: it needs a store event source.
export const STRATEGIES: Strategy[] = [
    {
        id: "S1", name: "Milestone onboarding", group: "approach", live: true,
        summary: "Move a new user from sign-up to their first win in stages, and nudge when they stall.",
        objective: "Get new users to their first win",
        icp: "Recent sign-ups or trial users who have not yet taken the key action. Not cold prospects.",
    },
    {
        id: "S3", name: "Daily narrative", group: "approach", live: true,
        summary: "A short story each day that earns attention, then turns to one offer.",
        objective: "Build trust with a daily story, then make one offer",
        icp: "A wider list that opted in to hear from you. Not suited to cold outreach.",
        pace: { minGapHours: 24, maxFirstWeekEmails: 7, maxEmails: 14 },
    },
    {
        id: "S6", name: "Habit loop", group: "approach", live: true,
        summary: "A trigger, an easy action, a reward that varies, then something the user invests in.",
        objective: "Bring existing users back to the product on a regular rhythm",
        icp: "Existing users who have completed at least one action.",
    },
    {
        id: "S10", name: "Broad-to-niche funnel", group: "approach", live: true,
        summary: "Win attention on a universal problem, then narrow to the tactical case and the niche.",
        objective: "Win attention on a wide problem, then narrow to the buyer it fits",
        icp: "Keep the ICP tight: a specific role in a specific situation. A broad ICP dilutes the narrowing.",
    },
    {
        id: "S11", name: "4-3-2-1 distribution", group: "approach", live: true,
        summary: "Across 10 sends: 4 topic pillars, 3 delivery styles, 2 conversation prompts and 1 clear offer.",
        objective: "Keep a steady mix of useful content with one clear offer per 10 sends",
        icp: "One audience that follows you for the topics, not for a single product.",
        pace: { maxEmails: 10 },
    },
    {
        id: "S4", name: "Editorial linter", group: "check", live: true,
        summary: "Flags jargon, a low you-to-we ratio and too many links.",
        effect: "Scores each email step as you write it and lists what to fix. It only advises.",
    },
    { id: "S5", name: "Deliverability and sunset", group: "check", live: false, summary: "Checks SPF and DMARC, and sunsets contacts silent for 90 days." },
    { id: "S7", name: "Conversion probability", group: "check", live: false, summary: "Scores motivation, clarity, incentive, friction and anxiety." },
    { id: "S8", name: "Six-factor diagnostic", group: "check", live: false, summary: "Scores value, relevance, clarity, urgency, anxiety and distraction." },
    { id: "S12", name: "Value equation", group: "check", live: false, summary: "Scores the offer on dream outcome, likelihood, delay and effort." },
    { id: "S14", name: "Seven-question pre-flight", group: "check", live: false, summary: "Confirms the brief answers the seven questions before drafting." },
    { id: "S9", name: "Three-part hook", group: "lens", live: false, summary: "Intercept, stakes, payoff in the opening." },
    { id: "S13", name: "Ten angles", group: "lens", live: false, summary: "Ten different angles on one core idea." },
    { id: "S15", name: "Top three criteria", group: "lens", live: false, summary: "Keeps an email to the three criteria that matter most." },
    { id: "S16", name: "Picture metaphor", group: "lens", live: false, summary: "Pairs an abstract point with a vivid image." },
    { id: "S17", name: "Primacy and recency", group: "lens", live: false, summary: "Puts the strongest points first and last." },
];

const BY_ID = new Map(STRATEGIES.map((s) => [s.id, s]));

export function findStrategy(id: string): Strategy | undefined {
    return BY_ID.get(id);
}

export const MAX_STRATEGIES = 5;

// A list of strategy ids that can be stored on a campaign: known, live, no repeats, a small number.
// Null when anything else is sent, so the caller can refuse it.
export function sanitizeStrategies(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length > MAX_STRATEGIES) return null;
    const ids: string[] = [];
    for (const item of value) {
        if (typeof item !== "string") return null;
        const strategy = BY_ID.get(item);
        if (!strategy?.live) return null;
        if (!ids.includes(item)) ids.push(item);
    }
    return ids;
}

// The pace limits for a campaign: the defaults, loosened or tightened by its strategies in the order
// they were chosen (a later strategy wins on a limit both set).
export function paceLimitsFor(ids: readonly string[] | null | undefined): PaceLimits {
    let limits: PaceLimits = { ...PACE_LIMITS };
    for (const id of ids ?? []) {
        const pace = BY_ID.get(id)?.pace;
        if (pace) limits = { ...limits, ...pace };
    }
    return limits;
}

// What the chosen strategies suggest for the objective and the ICP. Only approaches speak to these.
export function guidanceFor(ids: readonly string[] | null | undefined): { objective: string | null; icp: string[] } {
    const approaches = (ids ?? []).map((id) => BY_ID.get(id)).filter((s): s is Strategy => Boolean(s) && s!.group === "approach");
    return {
        objective: approaches.find((s) => s.objective)?.objective ?? null,
        icp: approaches.map((s) => s.icp).filter((text): text is string => Boolean(text)),
    };
}

export const MAX_OBJECTIVE_CHARS = 300;

export type StrategyInput = { strategies?: string[]; objective?: string };

// Reads the strategy fields of a create or update request. Absent fields are left out so an update
// that does not mention them changes nothing.
export function parseStrategyInput(body: Record<string, unknown>): { ok: true; value: StrategyInput } | { ok: false; error: string } {
    const value: StrategyInput = {};
    if (body["strategies"] !== undefined) {
        const strategies = sanitizeStrategies(body["strategies"]);
        if (!strategies) return { ok: false, error: `strategies must be a list of up to ${MAX_STRATEGIES} available strategy ids` };
        value.strategies = strategies;
    }
    if (body["objective"] !== undefined) {
        if (typeof body["objective"] !== "string") return { ok: false, error: "objective must be text" };
        value.objective = body["objective"].trim().slice(0, MAX_OBJECTIVE_CHARS);
    }
    return { ok: true, value };
}

// The campaign's aiConfig with the strategy fields applied. The objective is the existing `goal` field.
// Null when there is nothing to store.
export function applyStrategyInput(existing: unknown, input: StrategyInput): Record<string, unknown> | null {
    const base = typeof existing === "object" && existing !== null && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
    if (input.strategies !== undefined) base["strategies"] = input.strategies;
    if (input.objective !== undefined) {
        if (input.objective) base["goal"] = input.objective;
        else delete base["goal"];
    }
    return Object.keys(base).length > 0 ? base : null;
}

// What a campaign stores, read back from its aiConfig.
export function strategiesFromConfig(aiConfig: unknown): string[] {
    const raw = typeof aiConfig === "object" && aiConfig !== null ? (aiConfig as Record<string, unknown>)["strategies"] : undefined;
    return sanitizeStrategies(raw) ?? [];
}
