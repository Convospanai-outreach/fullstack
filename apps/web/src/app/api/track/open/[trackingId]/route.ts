import { NextRequest, NextResponse } from "next/server";
import { advanceLeadAfterEmailOpened } from "@/lib/crm/leadStageTransitions";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
  try {
    const { trackingId } = await params;
    const { prisma } = await import("@/lib/db");

    const email = await prisma.email.findFirst({
      where: { OR: [{ id: trackingId }, { trackingId }] },
      select: { id: true, campaignId: true, leadId: true, mailboxId: true, openedAt: true, variantId: true },
    });

    if (email) {
      const mailbox = email.mailboxId
        ? await prisma.connectedMailbox.findUnique({ where: { id: email.mailboxId }, select: { teamId: true } })
        : null;

      if (!email.openedAt) {
        await prisma.email.update({ where: { id: email.id }, data: { openedAt: new Date() } }).catch(() => undefined);

        if (mailbox?.teamId) {
          await prisma.emailEvent.create({
            data: {
              teamId: mailbox.teamId,
              emailId: email.id,
              mailboxId: email.mailboxId,
              leadId: email.leadId,
              campaignId: email.campaignId,
              type: "OPENED",
            },
          }).catch(() => undefined);
        }

        if (email.mailboxId) {
          await prisma.connectedMailbox.update({
            where: { id: email.mailboxId },
            data: { openCount: { increment: 1 } },
          }).catch(() => undefined);
        }

        if (email.variantId) {
          await prisma.campaignVariant.update({
            where: { id: email.variantId },
            data: { openCount: { increment: 1 } },
          }).catch(() => undefined);
        }

        await advanceLeadAfterEmailOpened(prisma, {
          leadId: email.leadId,
          teamId: mailbox?.teamId || null,
          campaignId: email.campaignId,
          emailId: email.id,
        }).catch(() => undefined);
      }
    }
  } catch {
    // Never fail the pixel request — always return the image
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
