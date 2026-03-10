// @vitest-environment node
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 🔹 Mock local embedding generator
function generateMockEmbedding(text: string, dim: number = 1536): number[] {
  const hash = Array.from(text)
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array.from({ length: dim }, (_, i) => ((hash * (i + 1)) % 997) / 997);
}

describe('Prisma Vector Storage Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should store and compare vector embeddings', async () => {
    const textContent =
      "ConvoSpan is an AI automation platform that integrates LinkedIn scraping, Gemini-based personalization, and SendPulse outreach.";

    // Generate mock embedding
    const mockEmbedding = generateMockEmbedding(textContent);
    expect(mockEmbedding).toHaveLength(1536);

    // Insert into VectorDocument
    const vectorDoc = await prisma.vectorDocument.create({
      data: {
        type: 'company',
        content: textContent,
        metadata: JSON.stringify({ source: 'mock', offline: true }),
        embedding: JSON.stringify(mockEmbedding),
      },
    });

    // Verify created document
    expect(vectorDoc).toBeDefined();
    expect(vectorDoc.type).toBe('company');
    expect(vectorDoc.content).toBe(textContent);

    // Query all vectors and verify count
    const allVectors = await prisma.vectorDocument.findMany();
    expect(allVectors.length).toBeGreaterThan(0);

    // Test similarity comparison
    const compareText = "AI automation and LinkedIn personalization platform.";
    const compareVector = generateMockEmbedding(compareText);
    const cosineSimilarity = (a: number[], b: number[]) => {
      const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
      const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
      const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
      return dot / (magA * magB);
    };

    const similarity = cosineSimilarity(mockEmbedding, compareVector);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });
});
