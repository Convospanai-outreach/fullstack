// @vitest-environment node
import type { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrlEnv, hasTestDatabase } from "./utils/db";

const databaseUrl = ensureDatabaseUrlEnv();
const shouldRunDb = hasTestDatabase;
const maybeTest = shouldRunDb ? test : test.skip;
let prisma: PrismaClient | null = null;
let dbReady = false;

async function main(client: PrismaClient) {
  console.log('🚀 Starting Prisma verification test...\n');

  // 1️⃣ Insert mock VectorDocument
  const vectorDoc = await client.vectorDocument.create({
    data: {
      type: 'linkedin',
      content: 'John Doe is Head of Operations at Acme Corp.',
      metadata: JSON.stringify({ company: 'Acme Corp', role: 'Operations Head' }),
      embedding: JSON.stringify([0.12, 0.45, 0.33, 0.91]),
    },
  });

  console.log('✅ VectorDocument inserted:', vectorDoc);

  // 2️⃣ Query recently added vector
  const foundVectors = await client.vectorDocument.findMany({
    where: { type: 'linkedin' },
    orderBy: { created_at: 'desc' },
    take: 1,
  });

  console.log('\n🔍 Retrieved latest vector doc:', foundVectors[0]);

  // 3️⃣ Insert mock EngagementLog
  const engagementLog = await client.engagementLog.create({
    data: {
      email: 'john.doe@acmecorp.com',
      event: 'email_sent',
      context: 'Sent personalized outreach based on company insights',
      result: JSON.stringify({
        subject: 'Helping Acme optimize operations with AI-driven analytics',
        status: 'sent',
        timestamp: new Date().toISOString(),
      }),
    },
  });

  console.log('\n✅ EngagementLog inserted:', engagementLog);

  // 4️⃣ Query engagement logs
  const logs = await client.engagementLog.findMany({
    where: { email: 'john.doe@acmecorp.com' },
  });

  console.log('\n📬 Retrieved engagement logs:', logs);

  console.log('\n🎯 Prisma VectorDocument + EngagementLog test completed successfully!');
}

beforeAll(async () => {
  if (!shouldRunDb) return;
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });
  await prisma.$connect();
  dbReady = true;
});

describe("Prisma Tests", () => {
  maybeTest("should run the full prisma test flow", async () => {
    if (!dbReady || !prisma) return;
    await main(prisma);
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
});
