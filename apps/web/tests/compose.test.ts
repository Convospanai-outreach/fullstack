import { buildRAGContext } from "@/ai/ragEngine";
import { generateWithGemini } from "@/ai/gemini";

test("RAG context should return string", async () => {
  // ✅ fix: supply both args to match buildRAGContext(company, email)
  const context = await buildRAGContext("TestCo", "test@example.com");
  expect(typeof context).toBe("string");
});

test("Gemini mock returns text without API key", async () => {
  delete process.env['GEMINI_API_KEY'];
  const result = await generateWithGemini("Hello world");
  expect(result).toContain("Mock Gemini");
});
