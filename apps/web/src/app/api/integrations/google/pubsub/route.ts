import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message || !message.data) {
      return NextResponse.json({ ok: true, note: "No message data payload" });
    }

    const decodedData = Buffer.from(message.data, "base64").toString("utf8");
    let payload: any;
    try {
      payload = JSON.parse(decodedData);
    } catch {
      return NextResponse.json({ ok: true, note: "Raw text payload" });
    }

    const emailAddress = payload.emailAddress?.trim().toLowerCase();
    const eventType = payload.eventType || payload.type;
    const historyId = payload.historyId;

    if (!emailAddress) {
      return NextResponse.json({ ok: true, note: "Missing emailAddress in payload" });
    }

    const { prisma } = await import("@/lib/db");

    // 1. Find team associated with mailbox
    const mailbox = await prisma.connectedMailbox.findFirst({
      where: { email: emailAddress },
      select: { id: true, teamId: true },
    });

    const teamId = mailbox?.teamId;

    // 2. Automated Spam Complaint / Feedback Loop (FBL) Suppression Handler
    if (eventType === "SPAM_COMPLAINT" || eventType === "COMPLAINT" || payload.labelAdded === "SPAM") {
      const recipientEmail = (payload.recipientEmail || payload.targetEmail || "").trim().toLowerCase();
      if (teamId && recipientEmail) {
        await prisma.suppressionEntry.upsert({
          where: { teamId_email: { teamId, email: recipientEmail } },
          create: {
            teamId,
            email: recipientEmail,
            reason: "SPAM_COMPLAINT",
            source: "GOOGLE_POSTMASTER_FBL",
          },
          update: {
            reason: "SPAM_COMPLAINT",
            source: "GOOGLE_POSTMASTER_FBL",
          },
        });

        await prisma.lead.updateMany({
          where: { teamId, email: recipientEmail },
          data: { status: "OPT_OUT" },
        });
      }
    }

    // 3. Update mailbox lastSyncAt / historyId
    if (mailbox) {
      await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: {
          ...(historyId ? { historyId: String(historyId) } : {}),
          lastSyncAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal PubSub handler error" }, { status: 500 });
  }
}
