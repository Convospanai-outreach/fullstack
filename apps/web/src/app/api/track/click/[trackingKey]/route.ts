import { NextRequest, NextResponse } from "next/server";
import { advanceLeadAfterEmailClicked } from "@/lib/crm/leadStageTransitions";
import { JobQueue } from "@/lib/queue";

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackingKey: string }> }) {
  const { trackingKey } = await params;
  const { prisma } = await import("@/lib/db");

  const link = await prisma.trackedLink.findFirst({ where: { trackingKey } });
  if (!link) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const now = new Date();
    await prisma.trackedLink.update({
      where: { id: link.id },
      data: {
        clickCount: { increment: 1 },
        firstClickedAt: link.firstClickedAt || now,
        lastClickedAt: now,
      },
    });

    if (link.emailId) {
      const email = await prisma.email.findUnique({
        where: { id: link.emailId },
        select: { clickedAt: true, leadId: true, campaignId: true },
      });
      if (email && !email.clickedAt) {
        await prisma.email.update({ where: { id: link.emailId }, data: { clickedAt: now } }).catch(() => undefined);
        await advanceLeadAfterEmailClicked(prisma, {
          leadId: email.leadId,
          teamId: link.teamId,
          campaignId: email.campaignId,
          emailId: link.emailId,
        }).catch(() => undefined);
        // Rescore intent now that a real engagement signal exists - LeadScoringService
        // derives emailClicks from Email.clickedAt rows itself (OPEN-68), so this only
        // needs to trigger the recompute, not touch a counter.
        if (email.leadId) {
          await JobQueue.enqueue("lead_rescore", { leadId: email.leadId, teamId: link.teamId }).catch(() => undefined);
        }
      }
    }

    await prisma.emailEvent.create({
      data: {
        teamId: link.teamId,
        emailId: link.emailId,
        mailboxId: link.mailboxId,
        leadId: link.leadId,
        campaignId: link.campaignId,
        type: "CLICKED",
        payload: { destinationUrl: link.destinationUrl },
      },
    }).catch(() => undefined);

    if (link.mailboxId) {
      await prisma.connectedMailbox.update({
        where: { id: link.mailboxId },
        data: { clickCount: { increment: 1 } },
      }).catch(() => undefined);
    }
  } catch {
    // Never block the redirect on tracking failures
  }

  return NextResponse.redirect(link.destinationUrl);
}
