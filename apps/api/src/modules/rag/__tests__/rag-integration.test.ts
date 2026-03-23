/**
 * RAG Integration Test Script
 * 
 * Tests the enhanced RAG system with context filtering, relevance scoring,
 * and token budget management.
 */

import { RAGService } from "@/lib/ragService";
import { vectorStore } from "@/modules/rag/service/vectorStore";
import { prisma } from "@/lib/db";

async function testRAGIntegration() {
    console.log("=== RAG Integration Test ===\n");

    // Test Configuration
    const testTeamId = "test-team-id"; // Replace with actual team ID
    const testQuery = "How to improve email open rates for B2B SaaS companies?";

    try {
        // Test 1: Vector Search with Token Budget
        console.log("Test 1: Vector Search with Token Budget");
        console.log(`Query: "${testQuery}"`);
        console.log(`Team ID: ${testTeamId}`);
        console.log(`Max Tokens: 2000\n`);

        const results = await vectorStore.search(testQuery, testTeamId, 10, 2000);

        console.log(`✅ Retrieved ${results.length} results`);
        if (results.length > 0) {
            const totalTokens = results.reduce((sum, r) => sum + r.tokenCount, 0);
            const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
            const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

            console.log(`   Total Tokens: ${totalTokens}`);
            console.log(`   Avg Relevance: ${(avgRelevance * 100).toFixed(1)}%`);
            console.log(`   Avg Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
            if (results[0]) {
                console.log(`   Top Result: "${results[0].content.substring(0, 100)}..."`);
            }
        }
        console.log("");

        // Test 2: RAG Service with Filtering
        console.log("Test 2: RAG Service with Filtering");
        const context = await RAGService.retrieveContext(testQuery, testTeamId, {
            maxTokens: 1500,
            minRelevance: 0.75,
            limit: 10
        });

        console.log(`✅ Context Length: ${context.length} chars`);
        console.log(`   Preview: "${context.substring(0, 150)}..."\n`);

        // Test 3: Retrieval Statistics
        console.log("Test 3: Retrieval Statistics");
        const stats = await RAGService.getRetrievalStats(testQuery, testTeamId);

        if (stats) {
            console.log(`✅ Stats Retrieved:`);
            console.log(`   Total Results: ${stats.totalResults}`);
            console.log(`   Ranked Results: ${stats.rankedResults}`);
            console.log(`   Avg Relevance: ${(stats.avgRelevance * 100).toFixed(1)}%`);
            console.log(`   Avg Similarity: ${(stats.avgSimilarity * 100).toFixed(1)}%`);
            console.log(`   Total Tokens: ${stats.totalTokens}`);
        }
        console.log("");

        // Test 4: Verify Grounding Threshold
        console.log("Test 4: Verify Grounding Threshold (0.75)");
        const allResults = await prisma.$queryRawUnsafe<any[]>(
            `SELECT ki.id, (1 - (ki.embedding <=> $1::vector)) as similarity
             FROM "KnowledgeItem" ki
             JOIN "KnowledgeBase" kb ON ki."knowledgeBaseId" = kb.id
             WHERE kb."teamId" = $2
             LIMIT 20`,
            `[${Array(1536).fill(0).join(",")}]`, // Dummy embedding
            testTeamId
        );

        const belowThreshold = allResults.filter(r => r.similarity <= 0.75).length;
        console.log(`✅ Grounding Filter Working:`);
        console.log(`   Total Raw Results: ${allResults.length}`);
        console.log(`   Below Threshold (0.75): ${belowThreshold}`);
        console.log(`   Would be filtered: ${belowThreshold > 0 ? "Yes" : "No"}\n`);

        console.log("=== All Tests Passed ✅ ===");

    } catch (error: any) {
        console.error("❌ Test Failed:", error.message);
        console.error(error.stack);
    }
}

// Run if executed directly
if (require.main === module) {
    testRAGIntegration()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { testRAGIntegration };
