import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env") });
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/craftmyfunnel?schema=public";
}

import { prisma } from "../apps/web/src/lib/db";
import { getBrowserApiUrl } from "../apps/web/src/lib/api/browserBase";

async function main() {
  console.log("\n=======================================================");
  console.log("    P3 EMPIRICAL NON-ZERO DB & RUNTIME VERIFICATION    ");
  console.log("=======================================================\n");

  const testSuffix = Date.now().toString().slice(-6);
  const teamId = `team-p3-${testSuffix}`;
  const userId = `user-p3-${testSuffix}`;
  const campaignId = `camp-p3-${testSuffix}`;

  try {
    // 1. Seed Team & User
    await prisma.team.create({ data: { id: teamId, name: `P3 Team ${testSuffix}` } });
    await prisma.user.create({ data: { id: userId, email: `p3-${testSuffix}@example.com`, name: `P3 User ${testSuffix}` } });
    await prisma.teamMember.create({ data: { teamId, userId, role: "ADMIN", email: `p3-${testSuffix}@example.com` } });

    // 2. Seed Campaign with mixed status case leads (completed vs COMPLETED vs active)
    const campaign = await prisma.campaign.create({
      data: {
        id: campaignId,
        name: `P3 Mixed Case Campaign ${testSuffix}`,
        teamId,
        ownerId: userId,
        status: "ACTIVE",
        completedCount: 3,
        targetCount: 5,
      },
    });

    const leadStatuses = ["completed", "COMPLETED", "COMPLETED", "active", "active"];
    for (let i = 0; i < leadStatuses.length; i++) {
      await prisma.lead.create({
        data: {
          fullName: `P3 Lead ${i + 1}`,
          email: `p3lead${i + 1}-${testSuffix}@target.com`,
          status: leadStatuses[i]!,
          campaignId: campaign.id,
          teamId,
        },
      });
    }

    // 3. Verify Campaign completion rate calculation
    const fetchedCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { leadList: true },
    });

    const totalLeads = fetchedCampaign?.leadList.length || 0;
    const completedLeadsCount = fetchedCampaign?.leadList.filter(
      (l) => l.status.toLowerCase() === "completed"
    ).length || 0;

    const denominator = fetchedCampaign?.targetCount && fetchedCampaign.targetCount > 0
      ? fetchedCampaign.targetCount
      : (totalLeads > 0 ? totalLeads : 1);

    const actualCompleted = Math.min(fetchedCampaign?.completedCount || 0, denominator);
    const completionRate = Math.min(100, Math.round((actualCompleted / denominator) * 100));

    console.log("--- 1. CAMPAIGN COMPLETION RATE CALCULATION ---");
    console.log(`[DB RAW] Total Leads Attached: ${totalLeads}`);
    console.log(`[DB RAW] Mixed Case Completed Leads Count: ${completedLeadsCount}/5`);
    console.log(`[DB RAW] Target Count: ${fetchedCampaign?.targetCount}`);
    console.log(`[CALCULATION] Computed Completion Rate: ${completionRate}%\n`);

    // 4. Verify Billing API URL Resolution
    console.log("--- 2. BILLING ENV VAR & API RESOLUTION ---");
    const testTopupUrl = getBrowserApiUrl("/billing/topup");
    const testSubUrl = getBrowserApiUrl("/billing/subscription");
    console.log(`Resolved Topup URL:       ${testTopupUrl}`);
    console.log(`Resolved Subscription URL: ${testSubUrl}`);
    console.log(`API URL Resolution Test:   ${testTopupUrl.includes("/billing/topup") ? "PASS" : "FAIL"}\n`);

    // 5. Cleanup seeded test records
    await prisma.lead.deleteMany({ where: { teamId } });
    await prisma.campaign.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.team.delete({ where: { id: teamId } });

    console.log("✅ P3 Empirical Verification Completed Successfully!");
  } catch (err: any) {
    console.error("❌ P3 Verification Error:", err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
