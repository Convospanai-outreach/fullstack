import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAGES = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"];

// Read-only numbers for home's pipeline, channel and approval-record sections. Kept apart
// from /api/dashboard/summary so a failure here never blanks the rest of the home page.
export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");
    const { teamId } = await getCurrentContext();
    if (!teamId) return NextResponse.json({ stages: [], channels: [], record: [] });

    const since = new Date(Date.now() - 7 * 86400000);
    const callWhere = (types: string[]) => ({ lead: { teamId }, channel: { in: ["CALL", "call"] }, type: { in: types }, createdAt: { gte: since } });
    const linkedinWhere = (types: string[]) => ({ lead: { teamId }, channel: { in: ["LINKEDIN", "linkedin"] }, type: { in: types }, createdAt: { gte: since } });
    const [byStage, emailSent, emailReplies, linkedinContacted, linkedinReplied, callsMade, callsTalked, whatsappOut, whatsappIn, decisions] = await Promise.all([
      prisma.lead.groupBy({ by: ["pipelineState"], where: { teamId }, _count: { _all: true } }),
      // Email has no sent timestamp, so this is sent emails created in the window.
      prisma.email.count({ where: { lead: { teamId }, status: "sent", createdAt: { gte: since } } }),
      prisma.emailEvent.count({ where: { teamId, type: "REPLY_RECEIVED", createdAt: { gte: since } } }),
      // LinkedIn has no automatic reply capture, so both numbers are what people logged on a lead: leads contacted (outreach
      // marked done, or later marked replied) and leads marked replied. Profile captures and sequence events are not outreach.
      prisma.leadActivity.groupBy({ by: ["leadId"], where: linkedinWhere(["LINKEDIN_OUTREACH_DONE", "LINKEDIN_CONTACTED", "LINKEDIN_REPLIED"]) }),
      prisma.leadActivity.groupBy({ by: ["leadId"], where: linkedinWhere(["LINKEDIN_REPLIED"]) }),
      // Calls logged on a lead (the lead page, the journey API, and calls finished on the caller page). One call per lead
      // per window: a contacted-then-replied pair is the same call.
      prisma.leadActivity.groupBy({ by: ["leadId"], where: callWhere(["CALL_CONTACTED", "CALL_REPLIED"]) }),
      prisma.leadActivity.groupBy({ by: ["leadId"], where: callWhere(["CALL_REPLIED"]) }),
      prisma.whatsAppMessage.count({ where: { lead: { teamId }, direction: "OUTBOUND", createdAt: { gte: since } } }),
      prisma.whatsAppMessage.count({ where: { lead: { teamId }, direction: "INBOUND", createdAt: { gte: since } } }),
      prisma.approvalRequest.findMany({
        where: { teamId, status: { not: "PENDING" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, actionType: true, status: true, reviewedAt: true, updatedAt: true, reviewer: { select: { name: true, firstName: true } } },
      }),
    ]);

    const counts = new Map(byStage.map((row) => [row.pipelineState, row._count._all]));
    return NextResponse.json({
      stages: STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 })),
      // replies is null where a channel does not record replies at all.
      channels: [
        { channel: "email", sent: emailSent, replies: emailReplies },
        { channel: "linkedin", sent: linkedinContacted.length, replies: linkedinReplied.length },
        { channel: "whatsapp", sent: whatsappOut, replies: whatsappIn },
        { channel: "call", sent: callsMade.length, replies: callsTalked.length },
      ],
      // Decisions only: never the payload, so no message text or lead data leaves here.
      record: decisions.map((d) => ({
        id: d.id,
        action: d.actionType,
        status: d.status,
        at: (d.reviewedAt ?? d.updatedAt).toISOString(),
        by: d.reviewer?.name || d.reviewer?.firstName || null,
      })),
    });
  } catch (error) {
    console.error("Dashboard Overview API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
