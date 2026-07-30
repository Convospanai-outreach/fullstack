import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/craftmyfunnel?schema=public";
}

import { prisma } from "../apps/web/src/lib/db";

async function main() {
  console.log("\n=======================================================");
  console.log("   REPRODUCING APPROVAL RESOLUTION & STATUS FAILURE    ");
  console.log("=======================================================\n");

  const testSuffix = Date.now().toString().slice(-6);
  const teamId = `team-fail-${testSuffix}`;
  const userId = `user-fail-${testSuffix}`;
  const userEmail = `fail-${testSuffix}@example.com`;
  const campaignId = `camp-fail-${testSuffix}`;

  try {
    // 1. Create team, user, campaign
    await prisma.team.create({ data: { id: teamId, name: `Fail Test Team ${testSuffix}` } });
    await prisma.user.create({ data: { id: userId, email: userEmail, name: `Fail User ${testSuffix}` } });
    await prisma.teamMember.create({ data: { teamId, userId, role: "ADMIN", email: userEmail } });
    await prisma.campaign.create({ data: { id: campaignId, name: `Fail Campaign ${testSuffix}`, teamId, ownerId: userId, status: "active" } });

    // Seed 5 Email drafts & 5 ApprovalRequests with real payload structures
    const seededData = [];
    for (let i = 1; i <= 5; i++) {
      const lead = await prisma.lead.create({
        data: { fullName: `Test Lead ${i}`, email: `lead${i}@test.com`, teamId, campaignId, status: "DRAFT_READY" }
      });
      const email = await prisma.email.create({
        data: { leadId: lead.id, campaignId, subject: `Subject ${i}`, body: `Body ${i}`, status: "draft_ready" }
      });
      
      // Store payloads with variations (object vs string vs mismatched entityType)
      let payloadValue: any = {
        emailId: email.id,
        leadId: lead.id,
        campaignId,
        subject: email.subject,
        body: email.body,
        recipient: lead.email,
      };

      if (i === 1) {
        // Stringified JSON payload (common when payloads pass through Redis/JSON-unfriendly layers)
        payloadValue = JSON.stringify(payloadValue);
      } else if (i === 2) {
        // Missing emailId in payload object, only stored in entityId
        delete payloadValue.emailId;
      }

      const approval = await prisma.approvalRequest.create({
        data: {
          teamId,
          requesterId: userId,
          actionType: i % 2 === 0 ? "email_draft_approval" : "SEND_EMAIL_DRAFT",
          entityType: i % 2 === 0 ? "email" : "Email",
          entityId: email.id,
          status: "PENDING",
          payload: payloadValue,
        }
      });

      seededData.push({ emailId: email.id, leadId: lead.id, approvalId: approval.id, payloadValue });
    }

    console.log(`Seeded 5 ApprovalRequests with payload variations.`);

    // 2. TEST APPROVAL RESOLUTION FOR EACH ROW
    console.log("\n--- EXECUTING APPROVAL RESOLUTION & STATUS UPDATES ---");
    let successCount = 0;
    let failureCount = 0;

    for (const item of seededData) {
      const approval = await prisma.approvalRequest.findUnique({ where: { id: item.approvalId } });
      if (!approval) continue;

      let payloadObj = approval.payload as any;
      if (typeof payloadObj === "string") {
        try {
          payloadObj = JSON.parse(payloadObj);
        } catch (e) {
          console.error(`  ❌ Failed to parse stringified payload for approval ${approval.id}:`, e);
        }
      }

      const resolvedEmailId =
        payloadObj?.emailId ||
        payloadObj?.email_id ||
        (approval.entityType?.toLowerCase() === "email" ? approval.entityId : null);

      const resolvedLeadId =
        payloadObj?.leadId ||
        payloadObj?.lead_id ||
        (approval.entityType?.toLowerCase() === "lead" ? approval.entityId : null);

      console.log(`Approval ${approval.id} [actionType: ${approval.actionType}, entityType: ${approval.entityType}]:`);
      console.log(`  • Resolved emailId: ${resolvedEmailId}`);
      console.log(`  • Resolved leadId:  ${resolvedLeadId}`);

      if (!resolvedEmailId) {
        console.error(`  ❌ CRITICAL: Failed to resolve emailId for approval ${approval.id}!`);
        failureCount++;
        continue;
      }

      try {
        // Execute status updates with loud error handling (no empty catch)
        await prisma.approvalRequest.update({
          where: { id: approval.id },
          data: { status: "APPROVED", reviewerId: userId, reviewedAt: new Date() },
        });

        await prisma.email.update({
          where: { id: resolvedEmailId },
          data: { status: "queued" },
        });

        if (resolvedLeadId) {
          await prisma.lead.update({
            where: { id: resolvedLeadId },
            data: { status: "SENT" },
          });
        }

        const updatedEmail = await prisma.email.findUnique({ where: { id: resolvedEmailId } });
        console.log(`  ✅ Email status successfully updated in DB: ${updatedEmail?.status}`);
        successCount++;
      } catch (err: any) {
        console.error(`  ❌ DB Update Failure for approval ${approval.id}:`, err?.message || err);
        failureCount++;
      }
    }

    console.log("\n=======================================================");
    console.log(`SUMMARY: ${successCount}/5 Approvals Successfully Updated Email.status`);
    console.log(`         ${failureCount}/5 Failures Detected`);
    console.log("=======================================================\n");

  } finally {
    // Cleanup test data
    await prisma.approvalRequest.deleteMany({ where: { teamId } });
    await prisma.email.deleteMany({ where: { campaignId } });
    await prisma.lead.deleteMany({ where: { teamId } });
    await prisma.campaign.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
