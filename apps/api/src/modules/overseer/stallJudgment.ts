import { judgeStalledThread, NOUL_YES, STALL_NEXT_MOVES, type StallNextMove, type StallThreadJudgment, type StallThreadMessage } from "@/lib/ai/jev";

export type StallCandidate = {
    enrollmentId: string;
    sequenceName: string;
    stage: string;
    stallDays: number;
    // Team has WhatsApp Business API configured AND the lead has a phone number
    // and recorded WhatsApp consent - i.e. a personal WhatsApp check-in from a
    // rep is actually possible for this lead, not just theoretically useful.
    whatsappEligible: boolean;
    // The lead has replied since this enrollment started.
    replied: boolean;
    // How the latest of those replies was classified (Jev, via ReplyAnalyzerAgent), or a rep's
    // correction of it. Null when there is no reply or it hasn't been classified.
    replyClassification: string | null;
};

export type StallJudgment = {
    enrollmentId: string;
    nudgeType: "RESEND_STEP" | "ROUTE_MANUAL" | "LIKELY_DEAD" | "TRY_WHATSAPP";
    suggestion: string;
};

/**
 * Picks the nudge for one stalled enrollment. The rules live here, in code. They use only the
 * reply classification already stored for the Action Inbox. Jev's judgment, when a team has it
 * on, is combined with these rules by judgeStalledEnrollmentsWithJev below.
 */
export function judgeStalledEnrollment(candidate: StallCandidate): StallJudgment {
    const stalled = `Stalled ${candidate.stallDays.toFixed(1)} days at ${candidate.stage}`;
    const judgment = (nudgeType: StallJudgment["nudgeType"], suggestion: string): StallJudgment => ({
        enrollmentId: candidate.enrollmentId,
        nudgeType,
        suggestion
    });

    switch (candidate.replyClassification) {
        case "DNC":
            return judgment("LIKELY_DEAD", `${stalled}. The lead's latest reply asks not to be contacted again - consider ending this enrollment.`);
        case "NOT_INTERESTED":
            return judgment("LIKELY_DEAD", `${stalled}. The lead's latest reply turned the offer down - consider ending this enrollment.`);
        case "INTERESTED":
        case "QUESTION":
            return judgment("ROUTE_MANUAL", `${stalled}. The lead replied ${candidate.replyClassification === "INTERESTED" ? "with interest" : "with a question"} and nothing is scheduled - a rep should answer.`);
        case "OOO":
            return judgment("RESEND_STEP", `${stalled}. The lead's latest reply was an away message - resend this step once they are back.`);
    }

    if (candidate.replied) {
        return judgment("ROUTE_MANUAL", `${stalled}. The lead replied and nothing is scheduled - review the reply.`);
    }
    if (candidate.whatsappEligible) {
        return judgment("TRY_WHATSAPP", `${stalled} on email alone - this lead has WhatsApp available and consented, so a personal WhatsApp check-in may re-engage them.`);
    }
    return judgment("ROUTE_MANUAL", `${stalled} with no reply and no recorded next step - flagged for manual follow-up.`);
}

export function judgeStalledEnrollments(candidates: StallCandidate[]): StallJudgment[] {
    return candidates.map(judgeStalledEnrollment);
}

// --- Jev-judged stalls (per team) ---

// Team.enabledFeatures (a string array, default off). "shadow" asks Jev and logs its decision next
// to the rules' decision, but writes the rules' nudge, so the two can be compared first. "on" writes
// Jev's decision. Neither key: the rules alone, as before.
export const STALL_JEV_FEATURE = "overseer-jev-stall";
export const STALL_JEV_SHADOW_FEATURE = "overseer-jev-stall-shadow";
export type StallJevMode = "off" | "shadow" | "on";

export function stallJevMode(enabledFeatures: unknown): StallJevMode {
    if (!Array.isArray(enabledFeatures)) return "off";
    if (enabledFeatures.includes(STALL_JEV_FEATURE)) return "on";
    if (enabledFeatures.includes(STALL_JEV_SHADOW_FEATURE)) return "shadow";
    return "off";
}

// A Jev answer that is sure (at or above NOUL_YES). Anything less is ambiguous, and the rules decide.
const sure = (probability: number) => probability >= NOUL_YES;

/**
 * Combines the rules' judgment with Jev's answer. Jev can only make the outcome more cautious, or
 * confirm it:
 * - a stop request, a turn-down or a "stop" move gives LIKELY_DEAD, whatever the rules said;
 * - "escalate_to_human" turns an automated nudge (RESEND_STEP, TRY_WHATSAPP) into a rep's review;
 * - "wait" drops an automated nudge, unless the lead is waiting on us;
 * - a rep's hand-off (ROUTE_MANUAL, LIKELY_DEAD) is never removed, and nothing new is created.
 * `changed` is true when Jev's answer altered the rules' outcome.
 */
export function combineStallDecision(rule: StallJudgment, answer: StallThreadJudgment, candidate: StallCandidate): { judgment: StallJudgment | null; changed: boolean } {
    const move = (m: StallNextMove) => answer.nextMove.choice === m && sure(answer.nextMove.probabilities[m]);
    const automated = rule.nudgeType === "RESEND_STEP" || rule.nudgeType === "TRY_WHATSAPP";
    const stalled = `Stalled ${candidate.stallDays.toFixed(1)} days at ${candidate.stage}`;

    if (sure(answer.leadAskedToStop) || sure(answer.leadTurnedDown) || move("stop")) {
        if (rule.nudgeType === "LIKELY_DEAD") return { judgment: rule, changed: false };
        return {
            judgment: { enrollmentId: rule.enrollmentId, nudgeType: "LIKELY_DEAD", suggestion: `${stalled}. The lead's latest message asks not to be contacted or turns the offer down - consider ending this enrollment.` },
            changed: true
        };
    }
    if (automated && move("escalate_to_human")) {
        return {
            judgment: { enrollmentId: rule.enrollmentId, nudgeType: "ROUTE_MANUAL", suggestion: `${stalled}. The thread needs a person to read it before anything is sent - a rep should review it.` },
            changed: true
        };
    }
    if (automated && move("wait") && !sure(answer.leadWaitingOnUs)) {
        return { judgment: null, changed: true };
    }
    return { judgment: rule, changed: false };
}

export type StallJevInput = { candidate: StallCandidate; teamId: string; thread: StallThreadMessage[]; mode: StallJevMode };

// Metadata only: labels and rounded probabilities. Never message text.
export type StallDecisionLog = {
    enrollmentId: string;
    mode: StallJevMode;
    rule: StallJudgment["nudgeType"];
    // What Jev's answer would do: a nudge type, "wait", or null when Jev gave no answer.
    jevNudge: StallJudgment["nudgeType"] | "wait" | null;
    // "jev": Jev's answer was applied and changed the outcome. "rules": the rules' nudge stands.
    // "fallback": Jev gave no answer, so the rules stand.
    applied: "jev" | "rules" | "fallback";
    final: StallJudgment["nudgeType"] | null;
    probabilities: { leadWaitingOnUs: number; leadAskedToStop: number; leadTurnedDown: number; nextMove: Record<StallNextMove, number> } | null;
    jevError?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function summarise(answer: StallThreadJudgment): StallDecisionLog["probabilities"] {
    const p = answer.nextMove.probabilities;
    return {
        leadWaitingOnUs: round2(answer.leadWaitingOnUs),
        leadAskedToStop: round2(answer.leadAskedToStop),
        leadTurnedDown: round2(answer.leadTurnedDown),
        nextMove: Object.fromEntries(STALL_NEXT_MOVES.map((m) => [m, round2(p[m])])) as Record<StallNextMove, number>
    };
}

async function decideWithJev(input: StallJevInput): Promise<{ final: StallJudgment | null; log: StallDecisionLog | null }> {
    const { candidate, teamId, thread, mode } = input;
    const rule = judgeStalledEnrollment(candidate);
    if (mode === "off") return { final: rule, log: null };

    const base = { enrollmentId: candidate.enrollmentId, mode, rule: rule.nudgeType };
    let answer: StallThreadJudgment;
    try {
        answer = await judgeStalledThread({ thread, quietForDays: Math.round(candidate.stallDays) }, teamId);
    } catch (error) {
        // An error is not a "no": the rules' nudge stands. Only the error's name is recorded.
        const jevError = error instanceof Error ? error.name : "UnknownError";
        return { final: rule, log: { ...base, jevNudge: null, applied: "fallback", final: rule.nudgeType, probabilities: null, jevError } };
    }

    const combined = combineStallDecision(rule, answer, candidate);
    const final = mode === "on" ? combined.judgment : rule;
    return {
        final,
        log: {
            ...base,
            jevNudge: combined.judgment?.nudgeType ?? "wait",
            applied: mode === "on" && combined.changed ? "jev" : "rules",
            final: final?.nudgeType ?? null,
            probabilities: summarise(answer)
        }
    };
}

/**
 * Judges candidates with Jev where the team has it on or in shadow. Each candidate gets a decision
 * log (in shadow the rules' nudge is written and Jev's answer is only logged). Candidates in "off"
 * mode are returned with the rules' judgment and no log, and Jev is never asked about them.
 */
export async function judgeStalledEnrollmentsWithJev(inputs: StallJevInput[]): Promise<{ judgments: StallJudgment[]; logs: StallDecisionLog[] }> {
    const results = await Promise.all(inputs.map(decideWithJev));
    return {
        judgments: results.flatMap((r) => (r.final ? [r.final] : [])),
        logs: results.flatMap((r) => (r.log ? [r.log] : []))
    };
}
