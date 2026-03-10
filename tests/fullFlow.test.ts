// @vitest-environment node
import { PrismaClient } from "@prisma/client";
import { buildRAGContext, extractKeyInsights } from "@/ai/ragEngine";
import { generateWithGemini } from "@/ai/gemini";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.vectorDocument.deleteMany({});
  await prisma.engagementLog.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("🔗 Full AI + RAG + Analytics pipeline", () => {
  test("1️⃣ Inserts VectorDocument and retrieves via RAG", async () => {
    const doc = await prisma.vectorDocument.create({
      data: {
        type: "company",
        content: "Acme Corp focuses on optimizing marketing automation using AI-driven insights.",
        metadata: JSON.stringify({ industry: "SaaS", size: "200-500 employees" }),
      },
    });

    expect(doc).toHaveProperty("id");

    const context = await buildRAGContext("Acme Corp", "marketing automation");
    expect(context).toContain("Acme Corp");
  });

  test("2️⃣ Generates insights using Gemini (mock-safe)", async () => {
    delete process.env['GEMINI_API_KEY']; // Ensure mock mode works
    const insights = await extractKeyInsights(
      "Acme Corp focuses on optimizing marketing automation using AI."
    );

    expect(typeof insights).toBe("string");
    expect(insights.length).toBeGreaterThan(10);
  });

  test("3️⃣ Creates EngagementLog entry after email send", async () => {
    const log = await prisma.engagementLog.create({
      data: {
        email: "john.doe@acme.com",
        event: "email_sent",
        context: "Personalized email sent using AI insights for Acme Corp",
        result: JSON.stringify({
          status: "sent",
          subject: "AI Automation Opportunities for Acme",
          timestamp: new Date().toISOString(),
        }),
      },
    });

    expect(log.email).toBe("john.doe@acme.com");

    const retrievedLogs = await prisma.engagementLog.findMany({
      where: { email: "john.doe@acme.com" },
    });

    expect(retrievedLogs.length).toBeGreaterThan(0);
    const firstLog = retrievedLogs[0];
    if (!firstLog) throw new Error("No log found");
    expect(firstLog.result).toContain("AI Automation");
  });

  test("4️⃣ RAG + Gemini combined response integrity", async () => {
    const context = await buildRAGContext("Acme Corp", "AI automation");
    const response = await generateWithGemini(`Summarize this: ${context}`);

    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(10);
  });
});
