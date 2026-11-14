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
    const [byStage, emailSent, emailReplies, linkedinLogged, whatsappOut, whatsappIn, decisions] = await Promise.all([
      prisma.lead.groupBy({ by: ["pipelineState"], where: { teamId }, _count: { _all: true } }),
      // Email has no sent timestamp, so this is sent emails created in the window.
      prisma.email.count({ where: { lead: { teamId }, status: "sent", createdAt: { gte: since } } }),
      prisma.emailEvent.count({ where: { teamId, type: "REPLY_RECEIVED", createdAt: { gte: since } } }),
      prisma.leadActivity.count({ where: { lead: { teamId }, channel: { in: ["LINKEDIN", "linkedin"] }, createdAt: { gte: since } } }),
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
      // replies is null where the channel does not record replies yet.
      channels: [
        { channel: "email", sent: emailSent, replies: emailReplies },
        { channel: "linkedin", sent: linkedinLogged, replies: null },
        { channel: "whatsapp", sent: whatsappOut, replies: whatsappIn },
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
