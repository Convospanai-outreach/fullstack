// How long a sequence may go quiet before the Overseer calls it stalled, when its campaign follows a
// strategy that sets its own rhythm. The strategies themselves are chosen in the web app and stored on
// the campaign as aiConfig.strategies; only the stall rhythm lives here. Names repeat the web
// registry's (apps/web/src/lib/campaigns/strategies.ts) because the two apps share no package.

export const STRATEGY_STALL: Record<string, { name: string; days: number }> = {
    // A new user who has not reached their first win within 2 days needs a nudge.
    S1: { name: "Milestone onboarding", days: 2 },
    // A daily rhythm has missed its next send after 2 days.
    S3: { name: "Daily narrative", days: 2 },
};

export function strategyIdsFromConfig(aiConfig: unknown): string[] {
    const raw = typeof aiConfig === "object" && aiConfig !== null ? (aiConfig as Record<string, unknown>)["strategies"] : undefined;
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

export interface StallRule {
    days: number;
    // Said in the nudge when the strategy made the stall count sooner than the usual threshold.
    note: string | null;
}

// The shortest rhythm among the campaign's strategies, or the usual threshold.
export function stallRuleFor(aiConfig: unknown, defaultDays: number): StallRule {
    let best: { name: string; days: number } | null = null;
    for (const id of strategyIdsFromConfig(aiConfig)) {
        const rule = STRATEGY_STALL[id];
        if (rule && (!best || rule.days < best.days)) best = rule;
    }
    if (!best || best.days >= defaultDays) return { days: defaultDays, note: null };
    return {
        days: best.days,
        note: `${best.name} expects activity within ${best.days} days, so this counts as stalled sooner than the usual ${defaultDays}.`,
    };
}
