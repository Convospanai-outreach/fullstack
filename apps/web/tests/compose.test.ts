import { ensureDatabaseUrlEnv, hasTestDatabase } from "./utils/db";
import { vi, afterEach } from "vitest";

const databaseUrl = ensureDatabaseUrlEnv();
const shouldRunDb = hasTestDatabase;
const maybeTest = shouldRunDb ? test : test.skip;

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

maybeTest("RAG context should return string", async () => {
  const { buildRAGContext } = await import("@/ai/ragEngine");
  const context = await buildRAGContext("TestCo", "test@example.com");
  expect(typeof context).toBe("string");
});

test("Gemini forwards to API backend", async () => {
  delete process.env["GEMINI_API_KEY"];
  const mockFetch = stubGemini("Hello from API");
  const { generateWithGemini } = await import("@/ai/gemini");
  const result = await generateWithGemini("Hello world");
  expect(result).toBe("Hello from API");
  expect(mockFetch).toHaveBeenCalled();
});
