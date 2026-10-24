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
 * Picks the nudge for one stalled enrollment. The rules live here, in code; the only model
 * judgment they use is the reply classification already stored for the Action Inbox, so the
 * Overseer itself sends nothing to any AI provider.
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
