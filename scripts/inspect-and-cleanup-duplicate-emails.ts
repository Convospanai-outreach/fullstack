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
  console.log("=== INSPECTING ALL EMAIL ROWS IN LOCAL DATABASE ===");
  const emails = await prisma.email.findMany({
    orderBy: { createdAt: "asc" },
    include: { lead: true },
  });

  console.log(`Total Email rows found: ${emails.length}`);

  for (const e of emails) {
    console.log(`\nEmail ID: ${e.id}`);
    console.log(`  Subject:   ${e.subject}`);
    console.log(`  Status:    ${e.status}`);
    console.log(`  CreatedAt: ${e.createdAt.toISOString()}`);
    console.log(`  Lead:      ${e.lead?.fullName} (${e.lead?.email})`);
  }

  console.log("\n=== INSPECTING ALL APPROVAL REQUEST ROWS ===");
  const approvals = await prisma.approvalRequest.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total ApprovalRequest rows found: ${approvals.length}`);
  for (const a of approvals) {
    console.log(`\nApproval ID: ${a.id}`);
    console.log(`  entityId:   ${a.entityId}`);
    console.log(`  status:     ${a.status}`);
    console.log(`  CreatedAt:  ${a.createdAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error inspecting database:", err);
  process.exit(1);
});
