import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

const CHANNELS = ["EMAIL", "LINKEDIN", "WHATSAPP", "CALL"] as const;
const CHANNEL_STATUSES = ["NOT_STARTED", "CAPTURED", "DRAFTED", "CONTACTED", "REPLIED", "FOLLOW_UP", "CLOSED"] as const;

const JourneyUpdateSchema = z.object({
    channel: z.enum(CHANNELS),
    status: z.enum(CHANNEL_STATUSES),
    notes: z.string().trim().max(4000).optional(),
    title: z.string().trim().max(160).optional(),
    outcome: z.enum(["WON", "LOST", "NOT_RELEVANT"]).optional(),
    nextFollowUpAt: z.string().datetime().optional(),
});

const CLOSED_LEAD_STATUSES = new Set(["WON", "LOST", "CONVERTED"]);
const CLOSED_PIPELINE_STATES = new Set(["CLOSED_WON", "CLOSED_LOST", "COMPLETED"]);
const PIPELINE_RANK: Record<string, number> = {
    COLD: 0,
    WARM: 1,
    HOT: 2,
    COORDINATING: 3,
    MEETING_CONFIRMED: 4,
    COMPLETED: 5,
    CLOSED_WON: 6,
    CLOSED_LOST: 6,
};

function titleFor(channel: string, status: string, outcome?: string) {
    if (status === "CAPTURED") return `${channel} profile captured`;
    if (status === "DRAFTED") return `${channel} draft prepared`;
    if (status === "CONTACTED") return `${channel} outreach marked done`;
    if (status === "REPLIED") return `${channel} reply recorded`;
    if (status === "FOLLOW_UP") return `${channel} follow-up needed`;
    if (status === "CLOSED") return `${channel} closed${outcome ? `: ${outcome.toLowerCase().replaceAll("_", " ")}` : ""}`;
    return `${channel} marked ${status.toLowerCase().replaceAll("_", " ")}`;
}

function forwardPipeline(current: string | null | undefined, next: string) {
    const currentState = current || "COLD";
    if (CLOSED_PIPELINE_STATES.has(currentState)) return currentState;
    return (PIPELINE_RANK[next] ?? 0) > (PIPELINE_RANK[currentState] ?? 0) ? next : currentState;
}

function resolveOverallState(input: {
    currentStatus?: string | null;
    currentPipeline?: string | null;
    channel: string;
    status: string;
    outcome?: string;
    channelStatuses: Array<{ channel: string; status: string }>;
}) {
    const currentStatus = input.currentStatus || "NEW";
    const currentPipeline = input.currentPipeline || "COLD";
    if (CLOSED_LEAD_STATUSES.has(currentStatus) || CLOSED_PIPELINE_STATES.has(currentPipeline)) {
        return { status: currentStatus, pipelineState: currentPipeline };
    }

    if (input.status === "CLOSED") {
        if (input.outcome === "WON") return { status: "WON", pipelineState: "CLOSED_WON" };
        if (input.outcome === "LOST" || input.outcome === "NOT_RELEVANT") return { status: "LOST", pipelineState: "CLOSED_LOST" };
        return { status: currentStatus, pipelineState: currentPipeline };
    }

    const merged = new Map(input.channelStatuses.map((item) => [item.channel, item.status]));
    merged.set(input.channel, input.status);
    const touchedChannels = [...merged.values()].filter((status) => status !== "NOT_STARTED");
    const contactedChannels = [...merged.values()].filter((status) => ["CONTACTED", "REPLIED", "FOLLOW_UP", "CLOSED"].includes(status));

    if (input.status === "FOLLOW_UP") {
        return { status: "FOLLOW_UP_NEEDED", pipelineState: forwardPipeline(currentPipeline, "WARM") };
    }
    if (input.status === "REPLIED") {
        return { status: "REPLIED", pipelineState: forwardPipeline(currentPipeline, "HOT") };
    }
    if (contactedChannels.length >= 2) {
        return { status: "MULTI_CHANNEL_CONTACTED", pipelineState: forwardPipeline(currentPipeline, "WARM") };
    }
    if (touchedChannels.length >= 2) {
        return { status: "MULTI_CHANNEL_ENGAGED", pipelineState: forwardPipeline(currentPipeline, "WARM") };
    }
    if (input.status === "CONTACTED") {
        return { status: "CONTACTED", pipelineState: forwardPipeline(currentPipeline, input.channel === "CALL" ? "COORDINATING" : "WARM") };
    }
    if (input.status === "CAPTURED" && input.channel === "LINKEDIN") {
        return { status: "LINKEDIN_CAPTURED", pipelineState: currentPipeline };
    }

    return { status: currentStatus, pipelineState: currentPipeline };
}

async function requireLead(id: string) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    await authorizeRole(userId, teamId, TeamRole.MEMBER);

    const lead = await (prisma as any).lead.findFirst({
        where: { id, teamId },
        include: { channelStatuses: true },
    });
    if (!lead) throw new APIError("Lead not found", 404, "NOT_FOUND");
    return { lead, teamId, userId };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { lead, teamId, userId } = await requireLead(id);
        const parsed = JourneyUpdateSchema.safeParse(await req.json());
        if (!parsed.success) {
            throw new APIError("Invalid journey update", 400, "VALIDATION_ERROR");
        }

        const now = new Date();
        const payload = parsed.data;
        const next = resolveOverallState({
            currentStatus: lead.status,
            currentPipeline: lead.pipelineState,
            channel: payload.channel,
            status: payload.status,
            outcome: payload.outcome,
            channelStatuses: lead.channelStatuses || [],
        });

        await (prisma as any).leadChannelStatus.upsert({
            where: { leadId_channel: { leadId: lead.id, channel: payload.channel } },
            update: { status: payload.status, lastActivityAt: now },
            create: { leadId: lead.id, channel: payload.channel, status: payload.status, lastActivityAt: now },
        });

        await (prisma as any).leadActivity.create({
            data: {
                leadId: lead.id,
                channel: payload.channel,
                type: `${payload.channel}_${payload.status}`,
                title: payload.title || titleFor(payload.channel, payload.status, payload.outcome),
                notes: payload.notes,
                metadata: {
                    source: "manual_journey_update",
                    outcome: payload.outcome || null,
                    nextFollowUpAt: payload.nextFollowUpAt || null,
                    previousStatus: lead.status || null,
                    previousPipelineState: lead.pipelineState || null,
                },
                createdBy: userId,
            },
        });

        const leadPatch: Record<string, any> = {};
        if (next.status !== (lead.status || "NEW")) leadPatch.status = next.status;
        if (next.pipelineState !== (lead.pipelineState || "COLD")) {
            leadPatch.pipelineState = next.pipelineState;
            leadPatch.pipelineStateChangedAt = now;
        }
        if (next.pipelineState === "HOT" && !lead.hotAt) leadPatch.hotAt = now;
        if (next.pipelineState === "CLOSED_WON" && !lead.wonAt) leadPatch.wonAt = now;
        if (next.pipelineState === "CLOSED_LOST" && !lead.lostAt) leadPatch.lostAt = now;
        if (Object.keys(leadPatch).length) {
            await (prisma as any).lead.updateMany({ where: { id: lead.id, teamId }, data: leadPatch });
        }

        const updated = await (prisma as any).lead.findFirst({
            where: { id: lead.id, teamId },
            include: {
                campaign: true,
                channelStatuses: true,
                leadActivities: { orderBy: { createdAt: "desc" }, take: 50 },
            },
        });

        return NextResponse.json({
            success: true,
            lead: updated,
            status: updated?.status,
            pipelineState: updated?.pipelineState,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}
