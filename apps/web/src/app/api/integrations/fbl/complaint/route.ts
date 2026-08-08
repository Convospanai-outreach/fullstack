import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const feedbackId = body.feedbackId || body["Feedback-ID"] || body["X-Feedback-ID"];
    const recipientEmail = (body.recipientEmail || body.email || "").trim().toLowerCase();

    if (!feedbackId && !recipientEmail) {
      return NextResponse.json({ error: "Missing Feedback-ID or recipient email." }, { status: 400 });
    }

    // Feedback-ID format: <campaignId>:<leadId>:<teamId>:craftmyfunnel
    const parts = String(feedbackId || "").split(":");
    const campaignId = parts[0];
    const leadId = parts[1];
    const teamId = parts[2];

    const { prisma } = await import("@/lib/db");

    // 1. Resolve lead & team
    let resolvedTeamId: string | null = teamId || null;
    let resolvedEmail: string | null = recipientEmail || null;

    if (leadId && !resolvedEmail) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { email: true, teamId: true },
      });
      if (lead && lead.email) {
        resolvedEmail = lead.email.toLowerCase();
        resolvedTeamId = resolvedTeamId || lead.teamId;
      }
    }

    if (!resolvedTeamId || !resolvedEmail) {
      return NextResponse.json({ error: "Could not resolve workspace team or lead recipient email." }, { status: 404 });
    }

    // 2. Idempotent Upsert into SuppressionEntry
    await prisma.suppressionEntry.upsert({
      where: { teamId_email: { teamId: resolvedTeamId, email: resolvedEmail } },
      create: {
        teamId: resolvedTeamId,
        email: resolvedEmail,
        reason: "SPAM_COMPLAINT",
        source: "FBL_FEEDBACK_LOOP",
        leadId: leadId || null,
      },
      update: {
        reason: "SPAM_COMPLAINT",
        source: "FBL_FEEDBACK_LOOP",
        leadId: leadId || null,
      },
    });

    // 3. Halt outreach by setting lead status to OPT_OUT
    await prisma.lead.updateMany({
      where: { teamId: resolvedTeamId, email: resolvedEmail },
      data: { status: "OPT_OUT" },
    });

    return NextResponse.json({ success: true, processed: true, email: resolvedEmail, teamId: resolvedTeamId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal FBL complaint handler error." }, { status: 500 });
  }
}
