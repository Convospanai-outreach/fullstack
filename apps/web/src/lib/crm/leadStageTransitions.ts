type PrismaLike = {
    lead: {
        findFirst: (args: any) => Promise<any>;
        update: (args: any) => Promise<any>;
    };
};

export const PIPELINE_STAGES = [
    "COLD",
    "WARM",
    "HOT",
    "COORDINATING",
    "MEETING_CONFIRMED",
    "COMPLETED",
    "CLOSED_WON",
    "CLOSED_LOST"
] as const;

export const PIPELINE_LABELS: Record<string, string> = {
    COLD: "New Leads",
    WARM: "Contacted",
    HOT: "High Intent",
    COORDINATING: "Meeting Coordination",
    MEETING_CONFIRMED: "Meeting Confirmed",
    COMPLETED: "Completed",
    CLOSED_WON: "Won",
    CLOSED_LOST: "Lost"
};

export const LEAD_STATUS_PRIORITY: Record<string, number> = {
    NEW: 0,
    CONTACTED: 1,
    ENGAGED: 2,
    REPLIED: 3,
    QUALIFIED: 4,
    MEETING_SCHEDULED: 5,
    PROPOSAL_SENT: 6,
    WON: 7,
    LOST: 7
};

export const PIPELINE_PRIORITY = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage, index) => {
    acc[stage] = index;
    return acc;
}, {});

type LeadState = {
    id: string;
    status?: string | null;
    pipelineState?: string | null;
    teamId?: string | null;
};

type AdvanceParams = {
    leadId: string;
    teamId?: string | null;
    campaignId?: string | null;
    emailId?: string | null;
};

type TransitionResult = {
    leadStageChanged: boolean;
    leadStatus: string;
    pipelineState: string;
    lead: any;
};

type TransitionPatch = {
    status?: string;
    pipelineState?: string;
    hotAt?: Date;
    wonAt?: Date;
    lostAt?: Date;
};

const CLOSED_STATUSES = new Set(["WON", "LOST"]);
const ADVANCED_EMAIL_STATUSES = new Set(["REPLIED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "WON", "LOST"]);
const CLOSED_PIPELINE_STATES = new Set(["CLOSED_WON", "CLOSED_LOST"]);

function priority(map: Record<string, number>, value?: string | null) {
    return map[value || ""] ?? 0;
}

function forwardStatus(current: string, next?: string) {
    if (!next) return current;
    return priority(LEAD_STATUS_PRIORITY, next) >= priority(LEAD_STATUS_PRIORITY, current) ? next : current;
}

function forwardPipeline(current: string, next?: string) {
    if (!next) return current;
    return priority(PIPELINE_PRIORITY, next) >= priority(PIPELINE_PRIORITY, current) ? next : current;
}

export function calculateLeadTransition(lead: LeadState, action: "EMAIL_SENT" | "EMAIL_OPENED" | "EMAIL_CLICKED" | "REPLY_RECEIVED" | "MEETING_SCHEDULED" | "WON" | "LOST", now = new Date()): TransitionPatch {
    const status = lead.status || "NEW";
    const pipelineState = lead.pipelineState || "COLD";

    if (action === "WON") return { status: "WON", pipelineState: "CLOSED_WON", wonAt: now };
    if (action === "LOST") return { status: "LOST", pipelineState: "CLOSED_LOST", lostAt: now };

    if (action === "EMAIL_SENT") {
        if (!["COLD", "WARM"].includes(pipelineState)) {
            return { status, pipelineState };
        }

        return {
            status: ADVANCED_EMAIL_STATUSES.has(status) ? status : forwardStatus(status, "CONTACTED"),
            pipelineState: pipelineState === "COLD" ? "WARM" : pipelineState
        };
    }

    if (action === "EMAIL_OPENED") {
        return {
            status: ["NEW", "CONTACTED"].includes(status) ? forwardStatus(status, "ENGAGED") : status,
            pipelineState: ["COLD", "WARM"].includes(pipelineState) ? forwardPipeline(pipelineState, "WARM") : pipelineState
        };
    }

    if (action === "EMAIL_CLICKED") {
        return {
            status: ["NEW", "CONTACTED", "ENGAGED"].includes(status) ? forwardStatus(status, "ENGAGED") : status,
            pipelineState: ["COLD", "WARM"].includes(pipelineState) ? "HOT" : pipelineState,
            ...(pipelineState !== "HOT" ? { hotAt: now } : {})
        };
    }

    if (action === "REPLY_RECEIVED") {
        return {
            status: CLOSED_STATUSES.has(status) ? status : forwardStatus(status, "REPLIED"),
            pipelineState: ["COLD", "WARM"].includes(pipelineState) ? "HOT" : pipelineState,
            ...(pipelineState !== "HOT" ? { hotAt: now } : {})
        };
    }

    if (action === "MEETING_SCHEDULED") {
        return {
            status: CLOSED_STATUSES.has(status) ? status : forwardStatus(status, "MEETING_SCHEDULED"),
            pipelineState: CLOSED_PIPELINE_STATES.has(pipelineState) ? pipelineState : forwardPipeline(pipelineState, "MEETING_CONFIRMED")
        };
    }

    return { status, pipelineState };
}

async function advanceLead(prisma: PrismaLike, params: AdvanceParams, action: Parameters<typeof calculateLeadTransition>[1]): Promise<TransitionResult> {
    const lead = await prisma.lead.findFirst({
        where: {
            id: params.leadId,
            ...(params.teamId ? { teamId: params.teamId } : {})
        }
    });

    if (!lead) {
        return { leadStageChanged: false, leadStatus: "", pipelineState: "", lead: null };
    }

    const next = calculateLeadTransition(lead, action);
    const statusChanged = next.status !== (lead.status || "NEW");
    const pipelineChanged = next.pipelineState !== (lead.pipelineState || "COLD");
    const data: any = {};

    if (statusChanged) data.status = next.status;
    if (pipelineChanged) {
        data.pipelineState = next.pipelineState;
        data.pipelineStateChangedAt = new Date();
    }
    if (next.hotAt && !lead.hotAt && next.pipelineState === "HOT") data.hotAt = next.hotAt;
    if (next.wonAt) data.wonAt = next.wonAt;
    if (next.lostAt) data.lostAt = next.lostAt;

    const updated = Object.keys(data).length
        ? await prisma.lead.update({ where: { id: lead.id }, data })
        : lead;

    return {
        leadStageChanged: statusChanged || pipelineChanged,
        leadStatus: updated.status,
        pipelineState: updated.pipelineState,
        lead: updated
    };
}

export function advanceLeadAfterEmailSent(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "EMAIL_SENT");
}

export function advanceLeadAfterEmailOpened(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "EMAIL_OPENED");
}

export function advanceLeadAfterEmailClicked(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "EMAIL_CLICKED");
}

export function advanceLeadAfterReply(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "REPLY_RECEIVED");
}

export function advanceLeadAfterMeetingScheduled(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "MEETING_SCHEDULED");
}

export function advanceLeadToWon(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "WON");
}

export function advanceLeadToLost(prisma: PrismaLike, params: AdvanceParams) {
    return advanceLead(prisma, params, "LOST");
}
