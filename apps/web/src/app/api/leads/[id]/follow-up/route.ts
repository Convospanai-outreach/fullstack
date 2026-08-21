import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

export const dynamic = "force-dynamic";

async function resolveTeamId() {
    const context = await getCurrentContext();
    if (context.teamId) return context.teamId;
    const user = await findOrCreateClerkAppUser();
    return user?.memberships.find((member) => member.status === "active")?.teamId || null;
}

// Queues a manual follow-up for human review in the Approvals queue —
// mirrors the KPI drill-down → "Send follow-up" → Approvals → Inbox loop.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { prisma } = await import("@/lib/db");
    const { id } = await params;
    const context = await getCurrentContext();
    const teamId = await resolveTeamId();
    if (!context.userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const lead = await prisma.lead.findFirst({ where: { id, teamId } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === "string" ? body.note.slice(0, 500) : undefined;

    const approval = await prisma.approvalRequest.create({
        data: {
            teamId,
            requesterId: context.userId,
            actionType: "manual_followup",
            entityType: "lead",
            entityId: lead.id,
            status: "PENDING",
            reason: note || `Follow-up requested for ${lead.fullName || lead.email || "lead"}`,
            payload: {
                leadId: lead.id,
                leadName: lead.fullName,
                company: lead.company,
                recipient: lead.email,
                note,
                source: "dashboard_kpi_drilldown",
            },
        },
    });

    await prisma.leadActivity.create({
        data: {
            leadId: lead.id,
            channel: "EMAIL",
            type: "FOLLOW_UP_FLAGGED",
            title: "Follow-up queued for approval",
            notes: note,
            createdBy: context.userId,
        },
    }).catch((err) => {
        console.error("[Lead Follow-up] Failed to log activity:", err?.message || err);
    });

    return NextResponse.json({ approval });
}
