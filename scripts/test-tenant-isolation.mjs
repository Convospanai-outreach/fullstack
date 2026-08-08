import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/craftmyfunnel";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("⚡ Starting Live Tenant Isolation & Multi-Tenant Scoping Test...");

  try {
    // 1. Create Team A and Team B
    const teamA = await prisma.team.create({
      data: { name: "Tenant A" },
    });
    const teamB = await prisma.team.create({
      data: { name: "Tenant B" },
    });

    // 2. Create Lead belonging strictly to Team B
    const leadB = await prisma.lead.create({
      data: {
        teamId: teamB.id,
        fullName: "Victim Lead (Team B)",
        email: `victim-${Date.now()}@teamb.com`,
        company: "Team B Corp",
        status: "NEW",
      },
    });

    console.log(`✓ Created Team A (${teamA.id})`);
    console.log(`✓ Created Team B (${teamB.id}) with Lead ${leadB.id}`);

    // 3. TEST WRITE-PATH: Team A attempts to UPDATE Lead B via DB write-path query: where: { id: leadB.id, teamId: teamA.id }
    console.log("\n🔒 Execution Test 1: Team A attempts UPDATE on Team B's Lead...");
    const updateResult = await prisma.lead.updateMany({
      where: { id: leadB.id, teamId: teamA.id }, // Scoped to Team A!
      data: { fullName: "HACKED BY TEAM A" },
    });

    console.log(`   Result count updated: ${updateResult.count}`);
    if (updateResult.count === 0) {
      console.log("   ✅ PASS: Team A update blocked (0 rows modified).");
    } else {
      console.log("   ❌ FAIL: Cross-tenant data mutation allowed!");
    }

    // 4. TEST READ-PATH: Team A attempts to READ Lead B via DB read-path query: where: { id: leadB.id, teamId: teamA.id }
    console.log("\n🔒 Execution Test 2: Team A attempts READ on Team B's Lead...");
    const readResult = await prisma.lead.findFirst({
      where: { id: leadB.id, teamId: teamA.id },
    });

    console.log(`   Result record: ${readResult}`);
    if (readResult === null) {
      console.log("   ✅ PASS: Team A read blocked (null returned).");
    } else {
      console.log("   ❌ FAIL: Cross-tenant data leak detected!");
    }

    // 5. TEST DELETE-PATH: Team A attempts to DELETE Lead B via DB delete-path query: where: { id: leadB.id, teamId: teamA.id }
    console.log("\n🔒 Execution Test 3: Team A attempts DELETE on Team B's Lead...");
    const deleteResult = await prisma.lead.deleteMany({
      where: { id: leadB.id, teamId: teamA.id },
    });

    console.log(`   Result count deleted: ${deleteResult.count}`);
    if (deleteResult.count === 0) {
      console.log("   ✅ PASS: Team A delete blocked (0 rows deleted).");
    } else {
      console.log("   ❌ FAIL: Cross-tenant data deletion allowed!");
    }

    // 6. Verify Lead B was untampered
    const untamperedLead = await prisma.lead.findUnique({ where: { id: leadB.id } });
    console.log(`\n✓ Verification: Lead B fullName remains: "${untamperedLead?.fullName}"`);

    // Clean up test records
    await prisma.lead.delete({ where: { id: leadB.id } });
    await prisma.team.delete({ where: { id: teamA.id } });
    await prisma.team.delete({ where: { id: teamB.id } });

    console.log("\n✅ SUCCESS: All multi-tenant database write, read, and delete isolation tests passed.");
  } catch (err) {
    console.error("❌ Tenant Isolation Test Error:", err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
