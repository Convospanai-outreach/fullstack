import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/craftmyfunnel";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("⚡ Starting Live PostgreSQL Atomic Mailbox Concurrency Test...");

  try {
    // 1. Create or find test team & test connected mailbox
    const team = await prisma.team.findFirst() || await prisma.team.create({
      data: { name: "Concurrency Test Team", slug: `test-team-${Date.now()}` },
    });

    const testEmail = `test-concurrency-${Date.now()}@craftmyfunnel.live`;
    const mailbox = await prisma.connectedMailbox.create({
      data: {
        teamId: team.id,
        email: testEmail,
        status: "CONNECTED",
        sentToday: 48,
        dailyLimit: 50,
      },
    });

    console.log(`✓ Created test mailbox ${mailbox.id} with sentToday=48, dailyLimit=50`);

    // 2. Fire 5 concurrent atomic SQL UPDATE queries via Promise.all
    // Logic: UPDATE "ConnectedMailbox" SET "sentToday" = "sentToday" + 1 WHERE id = $1 AND "sentToday" < "dailyLimit"
    const runAtomicUpdate = async (index) => {
      const count = await prisma.$executeRaw`
        UPDATE "ConnectedMailbox"
        SET "sentToday" = "sentToday" + 1, "lastSentAt" = NOW()
        WHERE id = ${mailbox.id} AND "sentToday" < "dailyLimit"
      `;
      return { workerIndex: index, updatedCount: Number(count) };
    };

    console.log("⚡ Firing 5 concurrent worker UPDATE queries via Promise.all...");
    const results = await Promise.all([
      runAtomicUpdate(1),
      runAtomicUpdate(2),
      runAtomicUpdate(3),
      runAtomicUpdate(4),
      runAtomicUpdate(5),
    ]);

    const succeeded = results.filter((r) => r.updatedCount === 1);
    const rejected = results.filter((r) => r.updatedCount === 0);

    console.log(`✓ Results: ${succeeded.length} succeeded, ${rejected.length} blocked by daily limit.`);

    const finalMailbox = await prisma.connectedMailbox.findUnique({
      where: { id: mailbox.id },
    });

    console.log(`✓ Final DB Mailbox sentToday count: ${finalMailbox?.sentToday} (Expected: 50)`);

    // Clean up test mailbox
    await prisma.connectedMailbox.delete({ where: { id: mailbox.id } });

    if (finalMailbox?.sentToday === 50 && succeeded.length === 2 && rejected.length === 3) {
      console.log("✅ SUCCESS: Postgres atomic UPDATE successfully serialized writes and prevented over-cap dispatches!");
    } else {
      console.log("⚠️ WARNING: DB count or concurrency serialization mismatch.");
    }
  } catch (err) {
    console.error("❌ Concurrency Test Error:", err?.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
