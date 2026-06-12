import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { normalizeFunnel } from "@/lib/crm/funnel";

export const dynamic = "force-dynamic";

async function resolveTeamId() {
    const context = await getCurrentContext();
    if (context.teamId) return context.teamId;

    const clerkUser = await findOrCreateClerkAppUser();
    return clerkUser?.memberships.find((member) => member.status === "active")?.teamId || null;
}

export async function GET() {
    const teamId = await resolveTeamId();
    if (!teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        prisma.lead.count({ where: { teamId, status: { in: ["CONTACTED", "ENGAGED", "REPLIED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "WON"] } } }),
        prisma.lead.count({ where: { teamId, pipelineState: "HOT" } }),
        prisma.lead.count({ where: { teamId, pipelineState: "MEETING_CONFIRMED" } }),
        prisma.lead.count({ where: { teamId, pipelineState: "CLOSED_WON" } }),
        prisma.lead.count({ where: { teamId, pipelineState: "CLOSED_LOST" } }),
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
}
