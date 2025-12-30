import { vectorStore } from "../../modules/rag/service/vectorStore";
import { prisma } from "../db";
import { aiService } from "../aiService";

// Mock AIService if API Key is missing
if (!process.env['GEMINI_API_KEY']) {
    console.warn("⚠️ GEMINI_API_KEY missing - Using DETERMINISTIC MOCKS for embeddings.");

    // Mock instance methods
    aiService.getEmbeddings = async (text: string) => {
        // Create a simple deterministic 768-dim vector based on text content
        const hash = text.split("").reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
        return Array(768).fill(0).map((_, i) => (Math.sin(hash + i) + 1) / 10);
    };

    aiService.askAI = async (prompt: string) => {
        if (prompt.includes("Who is the CEO")) return "Jane Doe is the CEO of ConvoSpan.";
        return "Mocked AI Response";
    };
}

async function testVectorSearch() {
    console.log("🚀 Starting Vector Search Verification Test...");

    try {
        // 1. Setup Test Data
        let team = await prisma.team.findFirst();
        if (!team) {
            console.log("⚠️ No team found. Bootstrapping test team...");
            team = await prisma.team.create({
                data: {
                    name: "Test RAG Team",
                    credits: 1000
                }
            });
        }

        console.log(`Using Team: ${team.name} (${team.id})`);

        const kb = await prisma.knowledgeBase.create({
            data: {
                name: "Test Verification KB",
                description: "Used for automated RAG testing",
                teamId: team.id
            }
        });

        // Use raw SQL to include the new embeddingModel field
        await prisma.$executeRawUnsafe(
            `INSERT INTO "KnowledgeItem" (id, content, "knowledgeBaseId", metadata, embedding, "embeddingModel", version, "createdAt") 
             VALUES ($1, $2, $3, $4::jsonb, $5::vector, $6, $7, NOW())`,
            crypto.randomUUID(),
            "The CEO of ConvoSpan is Jane Doe.",
            kb.id,
            '{}',
            `[${Array(768).fill(0.1).join(",")}]`,
            "embedding-001",
            1
        );

        console.log(`✅ Created Test Knowledge Base: ${kb.id}`);

        // 2. Add Documents (Chunking & Embedding)
        const testContent = "ConvoSpan is a world-class AI platform for personalized outreach. It uses pgvector for precision grounding. The CEO is Jane Doe.";
        await vectorStore.addDocument(testContent, kb.id, { source: "Test Doc" });
        console.log("✅ Added Test Document (Chunking & Vectorizing successful)");

        // 3. Perform Similarity Search
        console.log("🔍 Searching for: 'Who is the CEO of ConvoSpan?'");
        const results = await vectorStore.search("Who is the CEO of ConvoSpan?", team.id);

        console.log(`📊 Found ${results.length} results.`);
        results.forEach((r, i) => {
            console.log(`[${i + 1}] Score: ${r.score.toFixed(4)} | Content: ${r.content.substring(0, 50)}...`);
        });

        if (results.length > 0 && results[0].content.includes("Jane Doe")) {
            console.log("🌟 TEST PASSED: Accurate grounding detected!");
        } else {
            console.log("❌ TEST FAILED: Grounding accuracy below threshold.");
        }

        // 4. Cleanup
        await prisma.knowledgeBase.delete({ where: { id: kb.id } });
        console.log("🧹 Cleanup complete.");

    } catch (e) {
        console.error("❌ Test encountered an error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testVectorSearch();
