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
  console.log("=== RAW APPROVAL REQUEST PAYLOAD AUDIT ===");

  const approvals = await prisma.approvalRequest.findMany({
    select: {
      id: true,
      actionType: true,
      entityType: true,
      entityId: true,
      status: true,
      payload: true,
    },
  });

  console.log(`Total ApprovalRequest rows: ${approvals.length}`);

  for (const a of approvals) {
    console.log(`\nApproval ID: ${a.id}`);
    console.log(`  actionType: ${a.actionType}`);
    console.log(`  entityType: ${a.entityType}`);
    console.log(`  entityId:   ${a.entityId}`);
    console.log(`  status:     ${a.status}`);
    console.log(`  payload type: ${typeof a.payload}`);
    console.log(`  raw payload:`, JSON.stringify(a.payload));

    let parsedPayload: any = a.payload;
    if (typeof parsedPayload === "string") {
      try {
        parsedPayload = JSON.parse(parsedPayload);
      } catch (err) {
        console.error("  ❌ JSON Parse Error:", err);
      }
    }

    const resolvedEmailId =
      parsedPayload?.emailId ||
      parsedPayload?.email_id ||
      (a.entityType?.toLowerCase() === "email" ? a.entityId : null);

    console.log(`  resolved emailId: ${resolvedEmailId}`);

    if (resolvedEmailId) {
      const matchingEmail = await prisma.email.findUnique({
        where: { id: resolvedEmailId },
        select: { id: true, status: true, subject: true },
      });
      console.log(`  matching Email row in DB:`, matchingEmail ? JSON.stringify(matchingEmail) : "❌ NOT FOUND IN EMAIL TABLE");
    } else {
      console.log(`  ⚠️ Could not resolve emailId!`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error running audit:", err);
  process.exit(1);
});
