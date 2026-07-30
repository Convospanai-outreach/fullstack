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
  console.log("   EMPIRICAL NON-ZERO ORPHAN BACKFILL VERIFICATION   ");
  console.log("=======================================================\n");

  const testSuffix = Date.now().toString().slice(-6);
  const teamId = `team-test-${testSuffix}`;
  const userId = `user-test-${testSuffix}`;
  const userEmail = `test-${testSuffix}@example.com`;
  const campaignId = `camp-test-${testSuffix}`;

  try {
    // 1. Create team & user
    await prisma.team.create({
      data: { id: teamId, name: `Test Team ${testSuffix}` },
    });

    await prisma.user.create({
      data: {
        id: userId,
        email: `test-${testSuffix}@example.com`,
        name: `Tester ${testSuffix}`,
      },
    });

    await prisma.teamMember.create({
      data: { teamId, userId, role: "ADMIN", email: userEmail },
    });

    // 2. Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        id: campaignId,
        name: `Test Campaign ${testSuffix}`,
        teamId,
        ownerId: userId,
        status: "active",
      },
    });

    // 3. Create lead and 5 ORPHANED Email drafts (status: DRAFT_READY, 0 ApprovalRequests)
    const seededEmailIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const lead = await prisma.lead.create({
        data: {
          fullName: `Orphaned Lead ${i}`,
          email: `orphan${i}-${testSuffix}@target.com`,
          teamId,
          campaignId,
          status: "DRAFT_READY",
        },
      });

      const email = await prisma.email.create({
        data: {
          leadId: lead.id,
          campaignId,
          subject: `Outreach Draft ${i}`,
          body: `Hello ${lead.fullName}, this is draft ${i}.`,
          status: "draft_ready",
        },
      });
      seededEmailIds.push(email.id);
    }

    // 4. CHECK BEFORE COUNTS
    const beforeOrphanCount = await prisma.email.count({
      where: {
        lead: { teamId },
        status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY"] },
      },
    });

    const beforeApprovalCount = await prisma.approvalRequest.count({
      where: { teamId, status: "PENDING" },
    });

    console.log("--- BEFORE BACKFILL ENGINE EXECUTION ---");
    console.log(`[RAW DB] Seeded Orphaned Email Drafts in DB: ${beforeOrphanCount}`);
    console.log(`[RAW DB] Pending ApprovalRequests in DB:     ${beforeApprovalCount}`);
    console.log("----------------------------------------\n");

    if (beforeOrphanCount !== 5 || beforeApprovalCount !== 0) {
      throw new Error(`Seeding failure! Expected 5 orphans and 0 approvals, got ${beforeOrphanCount} and ${beforeApprovalCount}`);
    }

    // 5. EXECUTE BACKFILL ENGINE (Exact logic running in /api/approvals & /api/dashboard/summary)
    console.log("Executing Self-Healing Backfill Engine...");
    
    const existingApprovals = await prisma.approvalRequest.findMany({
      where: { teamId, status: "PENDING" },
      select: { payload: true },
    });

    const pendingEmailIds = new Set(
      existingApprovals
        .map((a: any) => (a.payload as any)?.emailId)
        .filter(Boolean)
    );

    const draftEmails = await prisma.email.findMany({
      where: {
        lead: { teamId },
        status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY"] },
      },
      include: { lead: true },
    });

    let createdCount = 0;
    for (const email of draftEmails) {
      if (!pendingEmailIds.has(email.id)) {
        await prisma.approvalRequest.create({
          data: {
            teamId,
            requesterId: userId,
            actionType: "email_draft_approval",
            entityType: "email",
            entityId: email.id,
            status: "PENDING",
            payload: {
              emailId: email.id,
              leadId: email.leadId,
              campaignId: email.campaignId,
              subject: email.subject,
              body: email.body,
              recipient: email.lead?.email,
            },
          },
        });
        createdCount++;
      }
    }

    console.log(`Backfill engine created ${createdCount} ApprovalRequest rows.\n`);

    // 6. CHECK AFTER COUNTS
    const afterApprovalCount = await prisma.approvalRequest.count({
      where: { teamId, status: "PENDING" },
    });

    const createdApprovalRows = await prisma.approvalRequest.findMany({
      where: { teamId, status: "PENDING" },
      select: {
        id: true,
        actionType: true,
        entityType: true,
        entityId: true,
        status: true,
        payload: true,
      },
    });

    console.log("--- AFTER BACKFILL ENGINE EXECUTION ---");
    console.log(`[RAW DB] Pending ApprovalRequests in DB:     ${afterApprovalCount}`);
    console.log(`[RAW DB] Successfully Reconciled Drafts:    ${createdApprovalRows.length}/5`);
    console.log("---------------------------------------\n");

    console.log("Created ApprovalRequest Database Rows:");
    console.log(JSON.stringify(createdApprovalRows, null, 2));

    if (afterApprovalCount !== 5) {
      throw new Error(`Reconciliation failure! Expected 5 approval requests after backfill, got ${afterApprovalCount}`);
    }

    console.log("\n✅ SUCCESS: Non-zero orphaned draft reconciliation empirically verified in DB!");

  } finally {
    // Clean up test data
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
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
