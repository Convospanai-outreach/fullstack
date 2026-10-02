import { NextRequest, NextResponse } from "next/server";
import { advanceLeadAfterEmailClicked } from "@/lib/crm/leadStageTransitions";
import { JobQueue } from "@/lib/queue";
import { withUtm } from "@/lib/utm";

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

  return NextResponse.redirect(await withSequenceUtm(link).catch(() => link.destinationUrl));
}

// CMf's own landing pages, the only links that get UTM on the way out.
const LANDING_ORIGINS = new Set(
  [process.env["WEB_BASE_URL"], process.env["NEXTAUTH_URL"], process.env["APP_URL"], "https://craftmyfunnel.live"]
    .flatMap((value) => {
      try {
        return value ? [new URL(value).origin] : [];
      } catch {
        return [];
      }
    }),
);

// Creator funnel attribution: a click on a CMf /p/ landing page link in a sequence email gets
// utm_source=email, utm_medium=sequence, the campaign and the step. Added here, at redirect
// time, so the send path and the stored email stay as they were. Params already in the link win.
async function withSequenceUtm(link: { teamId: string; emailId: string | null; campaignId: string | null; destinationUrl: string }) {
  let destination: URL;
  try {
    destination = new URL(link.destinationUrl);
  } catch {
    return link.destinationUrl;
  }
  if (!LANDING_ORIGINS.has(destination.origin) || !destination.pathname.startsWith("/p/")) return link.destinationUrl;
  const { prisma } = await import("@/lib/db");
  const run = link.emailId
    ? await prisma.sequenceStepRun.findFirst({ where: { emailId: link.emailId, teamId: link.teamId }, select: { sequenceStepId: true } })
    : null;
  return withUtm(link.destinationUrl, { source: "email", medium: "sequence", campaign: link.campaignId, content: run?.sequenceStepId ?? null });
}
