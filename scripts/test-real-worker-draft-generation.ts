import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/craftmyfunnel?schema=public";
}

import { prisma } from "../apps/web/src/lib/db";
import { handleCampaignExecution } from "../apps/web/src/workers/handlers/campaign-execution-worker";

async function main() {
  console.log("\n=======================================================");
  console.log("   REAL WORKER DRAFT & APPROVAL GENERATION TEST   ");
  console.log("=======================================================\n");

  const testSuffix = Date.now().toString().slice(-6);
  const teamId = `team-worker-${testSuffix}`;
  const userId = `user-worker-${testSuffix}`;
  const campaignId = `camp-worker-${testSuffix}`;

  try {
    // 1. Seed team, user, and campaign
    await prisma.team.create({ data: { id: teamId, name: `Worker Team ${testSuffix}` } });
    await prisma.user.create({ data: { id: userId, email: `worker-${testSuffix}@example.com`, name: `Worker User ${testSuffix}` } });
    await prisma.teamMember.create({ data: { teamId, userId, role: "ADMIN", email: `worker-${testSuffix}@example.com` } });

    const campaign = await prisma.campaign.create({
      data: {
        id: campaignId,
        name: `Worker Test Campaign ${testSuffix}`,
        description: "Test campaign for worker-generated draft approval verification",
        teamId,
        ownerId: userId,
        status: "draft",
      },
    });

    const lead = await prisma.lead.create({
      data: {
        fullName: `Worker Lead ${testSuffix}`,
        email: `lead-${testSuffix}@target.com`,
        company: "Target Corp",
        status: "NEW",
        campaignId: campaign.id,
        teamId,
      },
    });

    console.log(`[SEED] Created Campaign ${campaign.id} and Lead ${lead.id}`);
    console.log("[WORKER] Executing handleCampaignExecution()...\n");

    // 2. Execute real worker handler
    await handleCampaignExecution({
      campaignId: campaign.id,
      teamId,
      userId,
    });

    // 3. Query DB directly for generated Email and ApprovalRequest
    const createdEmail = await prisma.email.findFirst({
      where: { campaignId: campaign.id, leadId: lead.id },
    });

    const createdApproval = await prisma.approvalRequest.findFirst({
      where: { entityId: createdEmail?.id },
      include: { requester: { select: { email: true } } },
    });

    console.log("--- DIRECT DATABASE VERIFICATION ---");
    console.log(`Generated Email ID:       ${createdEmail?.id}`);
    console.log(`Generated Email Subject:  ${createdEmail?.subject}`);
    console.log(`Generated Email Status:   ${createdEmail?.status}`);
    console.log(`ApprovalRequest ID:       ${createdApproval?.id}`);
    console.log(`ApprovalRequest Status:   ${createdApproval?.status}`);
    console.log(`ApprovalRequest Requester:${createdApproval?.requester?.email}`);
    console.log(`ApprovalRequest Action:   ${createdApproval?.actionType}`);
    console.log(`ApprovalRequest EntityId: ${createdApproval?.entityId}`);

    if (createdEmail && createdApproval && createdApproval.entityId === createdEmail.id) {
      console.log("\n✅ SUCCESS: ApprovalRequest row was created directly at draft generation time by worker!");
    } else {
      console.log("\n❌ FAIL: ApprovalRequest row was not created!");
      process.exit(1);
    }

    // Cleanup
    await prisma.approvalRequest.deleteMany({ where: { teamId } });
    await prisma.email.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.lead.deleteMany({ where: { teamId } });
    await prisma.campaign.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.team.delete({ where: { id: teamId } });
  } catch (err: any) {
    console.error("❌ Worker Execution Error:", err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
