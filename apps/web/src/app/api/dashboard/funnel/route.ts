import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { normalizeFunnel } from "@/lib/crm/funnel";

export const dynamic = "force-dynamic";

const EMPTY_CARDS = {
    totalLeads: 0,
    contactedLeads: 0,
    hotLeads: 0,
    meetingsConfirmed: 0,
    wonLeads: 0,
    lostLeads: 0,
    emailsSent: 0,
    repliesReceived: 0,
    connectedMailboxes: 0
};

async function resolveTeamId() {
    const context = await getCurrentContext();
    if (context.teamId) return context.teamId;

    const clerkUser = await findOrCreateClerkAppUser();
    return clerkUser?.memberships.find((member) => member.status === "active")?.teamId || null;
}

export async function GET() {
    try {
        const { prisma } = await import("@/lib/db");
        const teamId = await resolveTeamId();
        if (!teamId) {
            return NextResponse.json({
                funnel: normalizeFunnel([]),
                cards: EMPTY_CARDS,
                setupRequired: true,
                message: "No active workspace was found for this account."
            });
        }

        const [
            groups,
            totalLeads,
            contactedLeads,
            hotLeads,
            meetingsConfirmed,
            wonLeads,
            lostLeads,
            emailsSent,
            repliesReceived,
            connectedMailboxes
        ] = await Promise.all([
            prisma.lead.groupBy({
                by: ["pipelineState"],
                where: { teamId },
                _count: { id: true }
            }),
            prisma.lead.count({ where: { teamId } }),
            prisma.lead.count({ where: { teamId, status: { in: ["CONTACTED", "REPLIED", "CONVERTED"] } } }),
            prisma.lead.count({ where: { teamId, pipelineState: "HOT" } }),
            prisma.lead.count({ where: { teamId, pipelineState: "MEETING_CONFIRMED" } }),
            prisma.lead.count({ where: { teamId, status: "CONVERTED" } }),
            prisma.lead.count({ where: { teamId, status: "LOST" } }),
            prisma.emailEvent.count({ where: { teamId, type: "SENT" } }),
            prisma.emailEvent.count({ where: { teamId, type: { in: ["REPLIED", "REPLY_RECEIVED"] } } }),
            prisma.connectedMailbox.count({ where: { teamId, status: "CONNECTED" } })
        ]);

        return NextResponse.json({
            funnel: normalizeFunnel(groups),
            cards: {
                totalLeads,
                contactedLeads,
                hotLeads,
                meetingsConfirmed,
                wonLeads,
                lostLeads,
                emailsSent,
                repliesReceived,
                connectedMailboxes
            }
        });
    } catch (error) {
        console.error("[dashboard:funnel] controlled_empty_state", error);
        return NextResponse.json({
            funnel: normalizeFunnel([]),
            cards: EMPTY_CARDS,
            degraded: true,
            errorCode: "FUNNEL_QUERY_FAILED",
            message: "Funnel data is temporarily unavailable."
        });
    }
}
