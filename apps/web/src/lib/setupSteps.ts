// Setup wizard: who the team does outreach for, and which steps that shows.
// Step ids stay fixed (deep links like /setup?step=3 depend on them); a personal
// user simply doesn't see the company-only steps.

export type OutreachMode = "personal" | "company";

/** Workspace Identity (brand), Handoffs, Invite Your Team. */
export const PERSONAL_HIDDEN_STEPS: ReadonlySet<number> = new Set([2, 11, 13]);

export function readOutreachMode(aiConfig: unknown): OutreachMode | null {
    const mode = (aiConfig as { outreachMode?: unknown } | null)?.outreachMode;
    return mode === "personal" || mode === "company" ? mode : null;
}

export function visibleStepIds(stepIds: readonly number[], mode: OutreachMode | null): number[] {
    return mode === "personal" ? stepIds.filter((id) => !PERSONAL_HIDDEN_STEPS.has(id)) : [...stepIds];
}

/** The visible step after `current`, or null when it is the last one. */
export function nextStepId(visible: readonly number[], current: number): number | null {
    return visible.find((id) => id > current) ?? null;
}

/** The visible step before `current`, or null when it is the first one. */
export function previousStepId(visible: readonly number[], current: number): number | null {
    return [...visible].reverse().find((id) => id < current) ?? null;
}
