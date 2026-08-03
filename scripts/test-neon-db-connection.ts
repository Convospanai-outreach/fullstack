import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.production") });

import { prisma } from "../apps/web/src/lib/db";

async function main() {
  console.log("\n=======================================================");
  console.log("   NEON DB STAGING CONNECTION TEST");
  console.log("=======================================================\n");

  const dbUrl = process.env.DATABASE_URL || "";
  console.log("DATABASE_URL Host:", dbUrl.replace(/:[^:@]+@/, ":****@"));

  try {
    const userCount = await prisma.user.count();
    const emailCount = await prisma.email.count();
    const approvalCount = await prisma.approvalRequest.count();

    console.log("\n--- STAGING DB QUERY RESULTS ---");
    console.log(`User Rows Count:            ${userCount}`);
    console.log(`Email Rows Count:           ${emailCount}`);
    console.log(`ApprovalRequest Rows Count: ${approvalCount}`);
    console.log("\n✅ SUCCESS: Neon database connection and query successful!");
  } catch (err: any) {
    console.error("\n❌ ERROR connecting to Neon staging DB:", err?.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
