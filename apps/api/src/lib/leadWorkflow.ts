// Read-only six-step workflow view for one lead, derived from records that already exist.
// Nothing here writes; the approval step only reports an ApprovalRequest that is waiting or decided.

export type StepKey = "signal" | "draft" | "channel" | "reply" | "approve" | "advance";
export type StepState = "done" | "active" | "waiting" | "blocked" | "todo";

export interface WorkflowStep {
    key: StepKey;
    label: string;
    state: StepState;
    gated: boolean;
    detail: string | null;
}

export interface WorkflowApproval {
    requestId: string;
    status: string; // PENDING | APPROVED | REJECTED
    actionType: string;
    reason: string | null;
    expiresAt: string | null;
}

export interface WorkflowInput {
    lead: {
        isEnriched: boolean;
        lastScoredAt: Date | null;
        dwellTimeMinutes: number | null;
        emailClicks: number | null;
        socialMentions: number | null;
        icpFitScore: number | null;
        replyOutcome: string | null;
        pipelineState: string | null;
        status: string | null;
        wonAt: Date | null;
    };
    emailCount: number;
    repliedEmailCount: number;
    generationCount: number;
    channelStatuses: string[];
    approval: { id: string; status: string; actionType: string; reason: string | null; autoDenyAt: Date | null } | null;
}

const OUTREACH_DONE = new Set(["CONTACTED", "REPLIED", "FOLLOW_UP", "CLOSED"]);
const DRAFT_DONE = new Set(["DRAFTED", ...OUTREACH_DONE]);
const ADVANCED_STATES = new Set(["COORDINATING", "MEETING_CONFIRMED", "COMPLETED", "CLOSED_WON"]);
const ADVANCED_STATUSES = new Set(["WON", "CONVERTED"]);
const APPROVAL_DETAIL: Record<string, string> = { PENDING: "Waiting for a manager", APPROVED: "Approved", REJECTED: "Rejected" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function deriveLeadWorkflow(input: WorkflowInput): { steps: WorkflowStep[]; approval: WorkflowApproval | null } {
    const { lead, emailCount, repliedEmailCount, generationCount, channelStatuses, approval } = input;
    const has = (set: Set<string>) => channelStatuses.some((s) => set.has(s));

    const hasSignal =
        lead.isEnriched ||
        lead.lastScoredAt !== null ||
        lead.icpFitScore !== null ||
        (lead.dwellTimeMinutes ?? 0) > 0 ||
        (lead.emailClicks ?? 0) > 0 ||
        (lead.socialMentions ?? 0) > 0;
    const drafted = emailCount > 0 || generationCount > 0 || has(DRAFT_DONE);
    const outreach = emailCount > 0 || has(OUTREACH_DONE);
    const replied = repliedEmailCount > 0 || lead.replyOutcome !== null || channelStatuses.includes("REPLIED");
    const advanced =
        ADVANCED_STATES.has(lead.pipelineState ?? "") || ADVANCED_STATUSES.has(lead.status ?? "") || lead.wonAt !== null;

    let approveState: StepState = "todo";
    if (approval?.status === "PENDING") approveState = "waiting";
    else if (approval?.status === "APPROVED") approveState = "done";
    else if (approval?.status === "REJECTED") approveState = "blocked";

    const steps: WorkflowStep[] = [
        { key: "signal", label: "Signal Review", state: hasSignal ? "done" : "todo", gated: false, detail: hasSignal ? "Engagement or fit data recorded" : "No signals yet" },
        { key: "draft", label: "Draft Prep", state: drafted ? "done" : "todo", gated: false, detail: drafted ? "Draft or email prepared" : "No draft yet" },
        { key: "channel", label: "Channel Connect", state: outreach ? "done" : "todo", gated: false, detail: outreach ? (emailCount > 0 ? `${plural(emailCount, "email")} sent` : "Outreach started") : "No outreach yet" },
        {
            key: "reply",
            label: "Reply Track",
            state: replied ? "done" : outreach ? "active" : "todo",
            gated: false,
            detail: replied ? (lead.replyOutcome ? `Outcome: ${lead.replyOutcome.replaceAll("_", " ")}` : "Reply received") : outreach ? "Waiting for a reply" : null,
        },
        { key: "approve", label: "Approve Action", state: approveState, gated: true, detail: approval ? (APPROVAL_DETAIL[approval.status] ?? null) : null },
        { key: "advance", label: "Advance Lead", state: advanced ? "done" : "todo", gated: true, detail: advanced ? `Stage: ${(lead.pipelineState ?? lead.status ?? "").replaceAll("_", " ").toLowerCase()}` : null },
    ];

    // The first step that is not done and has no state of its own is the one in progress.
    const firstOpen = steps.find((s) => s.state !== "done");
    if (firstOpen && firstOpen.state === "todo") firstOpen.state = "active";

    return {
        steps,
        approval: approval
            ? {
                  requestId: approval.id,
                  status: approval.status,
                  actionType: approval.actionType,
                  reason: approval.reason,
                  expiresAt: approval.status === "PENDING" && approval.autoDenyAt ? approval.autoDenyAt.toISOString() : null,
              }
            : null,
    };
}
