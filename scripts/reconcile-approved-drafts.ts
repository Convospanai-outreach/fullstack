import dotenv from "dotenv";
import path from "path";
import { URL } from "url";

dotenv.config({ path: path.resolve(__dirname, "../.env.production.local") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.production.local") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/craftmyfunnel?schema=public";
}

const rawUrl = process.env.DATABASE_URL;
let hostName = "unknown";
let dbName = "unknown";
try {
  const parsed = new URL(rawUrl.replace("postgresql://", "http://").replace("postgres://", "http://"));
  hostName = parsed.hostname;
  dbName = parsed.pathname.replace("/", "");
} catch (e) {
  hostName = "parse-error";
}

console.log("===============================================================");
console.log("   RECONCILING APPROVED DRAFTS & EXECUTING STATUS UPDATES      ");
console.log("===============================================================");
console.log(`📡 Resolved DB Host: ${hostName}`);
console.log(`🗄️  Resolved DB Name: ${dbName}`);
console.log("===============================================================\n");

import { prisma } from "../apps/web/src/lib/db";
import { handleEmailSending } from "../apps/web/src/workers/handlers/email-sending-worker";

async function main() {
  // 1. Find all APPROVED ApprovalRequest rows
  const approvedRequests = await prisma.approvalRequest.findMany({
    where: { status: "APPROVED" },
    include: { requester: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${approvedRequests.length} total APPROVED ApprovalRequest rows.\n`);

  const pendingReconciliation = [];

  for (const approval of approvedRequests) {
    let payload = (approval.payload as any) || {};
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {}
    }

    const emailId =
      payload.emailId ||
      payload.email_id ||
      (approval.entityType?.toLowerCase() === "email" ? approval.entityId : null);

    const leadId =
      payload.leadId ||
      payload.lead_id ||
      (approval.entityType?.toLowerCase() === "lead" ? approval.entityId : null);

    const campaignId = payload.campaignId;

    if (!emailId) {
      console.log(`⚠️ Approval ${approval.id}: Could not resolve emailId.`);
      continue;
    }

    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { lead: true },
    });

    if (!email) {
      console.log(`⚠️ Approval ${approval.id}: Linked Email ${emailId} not found in DB.`);
      continue;
    }

    const isDraftState = ["draft", "DRAFT", "draft_ready", "DRAFT_READY"].includes(email.status);

    if (isDraftState) {
      pendingReconciliation.push({
        approval,
        email,
        emailId,
        leadId: leadId || email.leadId,
        campaignId: campaignId || email.campaignId,
        payload,
      });
    } else {
      console.log(`ℹ️ Approval ${approval.id}: Email ${email.id} already in status '${email.status}'.`);
    }
  }

  console.log(`\nTargeting ${pendingReconciliation.length} APPROVED rows with stuck 'draft/draft_ready' Email status.\n`);

  if (pendingReconciliation.length === 0) {
    console.log("✅ No stuck APPROVED drafts found. All approved emails are in queued/sent status.");
    await prisma.$disconnect();
    return;
  }

  // 2. Execute reconciliation logic per row
  for (const item of pendingReconciliation) {
    const { approval, email, emailId, leadId, campaignId, payload } = item;

    console.log(`---------------------------------------------------------------`);
    console.log(`Approval ID: ${approval.id}`);
    console.log(`  BEFORE Status:`);
    console.log(`    • ApprovalRequest.status: ${approval.status}`);
    console.log(`    • Email.id:               ${email.id}`);
    console.log(`    • Email.status:           ${email.status}`);
    console.log(`    • Lead.id:                ${email.leadId}`);
    console.log(`    • Lead.status:             ${email.lead?.status}`);

    // Perform updates
    await prisma.email.update({
      where: { id: emailId },
      data: { status: "queued" },
    });

    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "SENT" },
      });
    }

    let sendResult = null;
    if (leadId && campaignId) {
      try {
        sendResult = await handleEmailSending({
          leadId,
          campaignId,
          teamId: approval.teamId,
          mailboxId: payload.mailboxId,
          subject: payload.subject || email.subject,
          body: payload.body || email.body,
        });
        console.log(`    • handleEmailSending Result:`, JSON.stringify(sendResult));
      } catch (sendErr: any) {
        console.log(`    • handleEmailSending Exception (Expected if no live mailbox):`, sendErr?.message || sendErr);
      }
    }

    // Query AFTER status
    const updatedEmail = await prisma.email.findUnique({
      where: { id: emailId },
      include: { lead: true },
    });

    const updatedApproval = await prisma.approvalRequest.findUnique({
      where: { id: approval.id },
    });

    console.log(`\n  AFTER Status:`);
    console.log(`    • ApprovalRequest.status: ${updatedApproval?.status}`);
    console.log(`    • Email.status:           ${updatedEmail?.status}`);
    console.log(`    • Lead.status:             ${updatedEmail?.lead?.status}`);
    console.log(`---------------------------------------------------------------\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Reconciliation script error:", err);
  process.exit(1);
});
