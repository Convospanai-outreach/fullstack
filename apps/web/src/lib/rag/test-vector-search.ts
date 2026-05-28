import { vectorStore } from "../../modules/rag/service/vectorStore";
import { prisma } from "../db";

if (!process.env["GEMINI_API_KEY"]) {
    throw new Error("GEMINI_API_KEY is required to run test-vector-search");
}

async function testVectorSearch() {
    console.log("Starting Vector Search Verification Test...");

    try {
        let team = await prisma.team.findFirst();
        if (!team) {
            console.log("No team found. Bootstrapping test team...");
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

        await prisma.$executeRawUnsafe(
            `INSERT INTO "KnowledgeItem" (id, content, "knowledgeBaseId", metadata, embedding, "embeddingModel", version, "createdAt") 
             VALUES ($1, $2, $3, $4::jsonb, $5::vector, $6, $7, NOW())`,
            crypto.randomUUID(),
            "The CEO of CraftMyFunnel is Jane Doe.",
            kb.id,
            '{}',
            `[${Array(768).fill(0.1).join(",")}]`,
            "embedding-001",
            1
        );

        console.log(`Created Test Knowledge Base: ${kb.id}`);

        const testContent = "CraftMyFunnel is a world-class AI platform for personalized outreach. It uses pgvector for precision grounding. The CEO is Jane Doe.";
        await vectorStore.addDocument(testContent, kb.id, { source: "Test Doc" });
        console.log("Added Test Document (Chunking and Vectorizing successful)");

        console.log("Searching for: 'Who is the CEO of CraftMyFunnel?'");
        const results = await vectorStore.search("Who is the CEO of CraftMyFunnel?", team.id);

        console.log(`Found ${results.length} results.`);
        results.forEach((r: any, i) => {
            const score = r.similarity !== undefined ? r.similarity : (r as any).score;
            console.log(`[${i + 1}] Score: ${score?.toFixed(4)} | Content: ${(r.content || "").substring(0, 50)}...`);
        });

        if (results.length > 0 && results[0]?.content?.includes("Jane Doe")) {
            console.log("TEST PASSED: Accurate grounding detected.");
        } else {
            console.log("TEST FAILED: Grounding accuracy below threshold.");
        }

        await prisma.knowledgeBase.delete({ where: { id: kb.id } });
        console.log("Cleanup complete.");

    } catch (e) {
        console.error("Test encountered an error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testVectorSearch();
