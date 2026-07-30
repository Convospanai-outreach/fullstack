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
  console.log("=== RAW DATABASE COUNTS VERIFICATION ===");
  
  const emailDrafts = await prisma.email.count({
    where: { status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY"] } }
  });

  const pendingApprovals = await prisma.approvalRequest.count({
    where: { status: "PENDING" }
  });

  const totalApprovals = await prisma.approvalRequest.count();

  console.log(`Total Email Drafts in DB: ${emailDrafts}`);
  console.log(`Pending ApprovalRequests in DB: ${pendingApprovals}`);
  console.log(`Total ApprovalRequests in DB: ${totalApprovals}`);
  
  const sampleApprovals = await prisma.approvalRequest.findMany({
    take: 5,
    select: {
      id: true,
      actionType: true,
      entityType: true,
      entityId: true,
      status: true,
      teamId: true,
      createdAt: true
    }
  });

  console.log("\nSample ApprovalRequest Rows:");
  console.log(JSON.stringify(sampleApprovals, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
