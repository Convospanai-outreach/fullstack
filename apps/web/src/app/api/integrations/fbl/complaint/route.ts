import { NextRequest, NextResponse } from "next/server";
import * as cryptoNode from "crypto";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // This endpoint flips a lead to OPT_OUT and can disclose a lead's
    // email/teamId purely from a caller-supplied leadId, so it must never
    // accept unauthenticated input - mirrors the shared-secret + HMAC +
    // replay-window pattern already used for the other internal-producer
    // webhook at apps/api/routes/webhooks/scraper-ingest/route.ts.
    const secret = req.headers.get("X-FBL-Secret");
    const timestamp = req.headers.get("X-FBL-Timestamp");
    const fblSecret = process.env["FBL_WEBHOOK_SECRET"] || "";
    if (!fblSecret) {
      return NextResponse.json({ error: "FBL webhook is not configured" }, { status: 503 });
    }
    if (!secret || !timestamp) {
      return NextResponse.json({ error: "Unauthorized: Missing security headers" }, { status: 401 });
    }
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Unauthorized: Timestamp limit exceeded" }, { status: 401 });
    }
    const expectedSecret = cryptoNode
      .createHmac("sha256", fblSecret)
      .update(`${bodyText}.${timestamp}`)
      .digest("hex");
    const providedBuffer = Buffer.from(secret, "hex");
    const expectedBuffer = Buffer.from(expectedSecret, "hex");
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !cryptoNode.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
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

    // Response deliberately omits email/teamId - this is a webhook ack, not
    // a lookup endpoint, and echoing resolved PII back to the caller isn't
    // needed by any legitimate producer.
    return NextResponse.json({ success: true, processed: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal FBL complaint handler error." }, { status: 500 });
  }
}
