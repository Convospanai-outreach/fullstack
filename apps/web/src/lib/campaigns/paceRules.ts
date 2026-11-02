// Pace guidance for a drip: how far apart email steps are and how many go out. These are common
// practice, not law, so every finding is a warning with its reason and nothing blocks saving or
// launching. Each rule is pure and independent, so a rule can be adjusted or removed on its own.

export interface PaceStep {
    id: string;
    stepType: string;
    delayDays: number;
    delayHours: number;
}

export type PaceSeverity = "warning" | "info";

export interface PaceFinding {
    ruleId: string;
    severity: PaceSeverity;
    // The steps the finding is about, so the canvas can mark them.
    stepIds: string[];
    message: string;
    why: string;
}

export const PACE_LIMITS = {
    // Emails closer together than this read as pressure.
    minGapHours: 48,
    // More than this many emails inside the first week.
    maxFirstWeekEmails: 3,
    firstWeekDays: 7,
    // More than this many emails in one drip.
    maxEmails: 6,
    // Contacts who have not engaged after this long should be sunset, not emailed again.
    maxSpanDays: 90,
} as const;

// The limits in force for a campaign. A strategy can loosen or tighten the defaults (strategies.ts).
export type PaceLimits = { [K in keyof typeof PACE_LIMITS]: number };

const HOURS_PER_DAY = 24;

function delayHours(step: PaceStep): number {
    return Math.max(0, step.delayDays || 0) * HOURS_PER_DAY + Math.max(0, step.delayHours || 0);
}

interface EmailTouch {
    id: string;
    // Hours from the start of the drip.
    atHours: number;
    // Hours since the previous email, or null for the first one.
    gapHours: number | null;
}

// Email steps with their position in time. Delays on other steps (a call, a LinkedIn step) still
// count: they push the next email later.
function emailTouches(steps: PaceStep[]): EmailTouch[] {
    const touches: EmailTouch[] = [];
    let clock = 0;
    let lastEmailAt: number | null = null;
    for (const step of steps) {
        clock += delayHours(step);
        if (step.stepType !== "EMAIL") continue;
        touches.push({ id: step.id, atHours: clock, gapHours: lastEmailAt === null ? null : clock - lastEmailAt });
        lastEmailAt = clock;
    }
    return touches;
}

const days = (hours: number) => (hours / HOURS_PER_DAY).toFixed(hours % HOURS_PER_DAY === 0 ? 0 : 1);

export function evaluatePace(steps: PaceStep[], limits: PaceLimits = PACE_LIMITS): PaceFinding[] {
    const touches = emailTouches(steps);
    const findings: PaceFinding[] = [];

    for (const touch of touches) {
        if (touch.gapHours !== null && touch.gapHours < limits.minGapHours) {
            findings.push({
                ruleId: "email-gap",
                severity: "warning",
                stepIds: [touch.id],
                message: `This email follows the last one after only ${days(touch.gapHours)} day${touch.gapHours === HOURS_PER_DAY ? "" : "s"}.`,
                why: `Emails closer than ${days(limits.minGapHours)} day${limits.minGapHours === HOURS_PER_DAY ? "" : "s"} apart tend to read as pressure and raise unsubscribes and spam complaints. Leave at least that long between emails.`,
            });
        }
    }

    const firstWeek = touches.filter((t) => t.atHours < limits.firstWeekDays * HOURS_PER_DAY);
    if (firstWeek.length > limits.maxFirstWeekEmails) {
        findings.push({
            ruleId: "first-week-load",
            severity: "warning",
            stepIds: firstWeek.slice(limits.maxFirstWeekEmails).map((t) => t.id),
            message: `${firstWeek.length} emails go out in the first week.`,
            why: `More than ${limits.maxFirstWeekEmails} emails in the first week is a heavy opening for a contact who has not replied. Spread them out.`,
        });
    }

    if (touches.length > limits.maxEmails) {
        findings.push({
            ruleId: "email-count",
            severity: "warning",
            stepIds: touches.slice(limits.maxEmails).map((t) => t.id),
            message: `This drip has ${touches.length} emails.`,
            why: `Replies drop off after the first few follow-ups while complaints keep rising. More than ${limits.maxEmails} emails to a silent contact rarely pays.`,
        });
    }

    const gaps = touches.filter((t) => t.gapHours !== null);
    for (let i = 1; i < gaps.length; i++) {
        const previous = gaps[i - 1]!.gapHours as number;
        const current = gaps[i]!.gapHours as number;
        // A shrinking gap that is already past the minimum; shorter-than-minimum is reported above.
        if (current >= limits.minGapHours && current < previous) {
            findings.push({
                ruleId: "shrinking-gaps",
                severity: "info",
                stepIds: [gaps[i]!.id],
                message: `This gap (${days(current)} days) is shorter than the one before it (${days(previous)} days).`,
                why: "Spacing usually stays the same or grows as a contact stays silent. Tightening it can feel like escalation.",
            });
        }
    }

    const last = touches[touches.length - 1];
    if (last && last.atHours > limits.maxSpanDays * HOURS_PER_DAY) {
        findings.push({
            ruleId: "sequence-length",
            severity: "warning",
            stepIds: [last.id],
            message: `The last email goes out ${days(last.atHours)} days after the start.`,
            why: `A contact who has not engaged in ${limits.maxSpanDays} days should be sunset rather than emailed again; it protects your sender reputation.`,
        });
    }

    return findings;
}

// The findings for one step, for a badge on that step.
export function findingsForStep(findings: PaceFinding[], stepId: string): PaceFinding[] {
    return findings.filter((f) => f.stepIds.includes(stepId));
}
