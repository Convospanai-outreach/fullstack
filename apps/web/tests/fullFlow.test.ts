// @vitest-environment node
import type { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrlEnv, hasTestDatabase } from "./utils/db";
import { vi, afterEach } from "vitest";

const databaseUrl = ensureDatabaseUrlEnv();
const shouldRunDb = hasTestDatabase;
const maybeTest = shouldRunDb ? test : test.skip;
let prisma: PrismaClient | null = null;

const stubGemini = (text: string) => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ text })
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeAll(async () => {
  if (!shouldRunDb) return;
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });
  await prisma.$connect();
  await prisma.vectorDocument.deleteMany({});
  await prisma.engagementLog.deleteMany({});
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
});

describe("Full AI + RAG + Analytics pipeline", () => {
  maybeTest("1: Inserts VectorDocument and retrieves via RAG", async () => {
    if (!prisma) throw new Error("Prisma client not initialized");
    const { buildRAGContext } = await import("@/ai/ragEngine");

    const doc = await prisma.vectorDocument.create({
      data: {
        type: "company",
        content: "Acme Corp focuses on optimizing marketing automation using AI-driven insights.",
        metadata: JSON.stringify({ industry: "SaaS", size: "200-500 employees" })
      }
    });

    expect(doc).toHaveProperty("id");

    const context = await buildRAGContext("Acme Corp", "marketing automation");
    expect(context).toContain("Acme Corp");
  });

  test("2: Gemini forwards to API backend", async () => {
    delete process.env["GEMINI_API_KEY"];
    const mockFetch = stubGemini("Summary from API");
    const { generateWithGemini } = await import("@/ai/gemini");
    const response = await generateWithGemini("Summarize this: test input");
    expect(response).toBe("Summary from API");
    expect(mockFetch).toHaveBeenCalled();
  });

  maybeTest("3: Creates EngagementLog entry after email send", async () => {
    if (!prisma) throw new Error("Prisma client not initialized");

    const log = await prisma.engagementLog.create({
      data: {
        email: "john.doe@acme.com",
        event: "email_sent",
        context: "Personalized email sent using AI insights for Acme Corp",
        result: JSON.stringify({
          status: "sent",
          subject: "AI Automation Opportunities for Acme",
          timestamp: new Date().toISOString()
        })
      }
    });

    expect(log.email).toBe("john.doe@acme.com");

    const retrievedLogs = await prisma.engagementLog.findMany({
      where: { email: "john.doe@acme.com" }
    });

    expect(retrievedLogs.length).toBeGreaterThan(0);
    const firstLog = retrievedLogs[0];
    if (!firstLog) throw new Error("No log found");
    expect(firstLog.result).toContain("AI Automation");
  });

  maybeTest("4: RAG + Gemini combined response integrity", async () => {
    if (!prisma) throw new Error("Prisma client not initialized");
    const { buildRAGContext } = await import("@/ai/ragEngine");
    const { generateWithGemini } = await import("@/ai/gemini");

    const context = await buildRAGContext("Acme Corp", "AI automation");
    stubGemini("Summary from API");
    const response = await generateWithGemini(`Summarize this: ${context}`);

    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(10);
  });
});
