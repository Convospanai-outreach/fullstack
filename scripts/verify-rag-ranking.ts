
import { OutcomeRAGService } from "../src/modules/rag/service/OutcomeRAGService";
import { prisma } from "../src/lib/db";

async function main() {
    console.log("Starting Ranking Verification...");
    const TEAM_ID = "test-team-rag-ranking";

    // Cleanup
    await prisma.knowledgePerformance.deleteMany({});
    await prisma.knowledgeItem.deleteMany({});
    await prisma.knowledgeBase.deleteMany({});
    await prisma.team.deleteMany({ where: { id: TEAM_ID } });

    // Dependencies
    console.log("Creating dependencies...");
    await prisma.team.create({ data: { id: TEAM_ID, name: "RAG Ranking Team" } });
    const kb = await prisma.knowledgeBase.create({
        data: { name: "Test KB", teamId: TEAM_ID }
    });

    // Create Items
    await prisma.knowledgeItem.create({
        data: { id: "item-high-perf", content: "High Content", knowledgeBaseId: kb.id }
    });
    await prisma.knowledgeItem.create({
        data: { id: "item-low-perf", content: "Low Content", knowledgeBaseId: kb.id }
    });
    // Note: item-new is theoretical so we won't put perf data for it, but we might need it for ranking if we passed it in.
    // The ranking function only uses IDs. But the script passed mock items with IDs.
    // If we want "item-new" to have a score of 0, we don't need a perf record.

    // Mock Knowledge Items (IDs only needed for ranking)
    const items = [
        { id: "item-high-perf", similarity: 0.8, content: "High Performance Content" },
        { id: "item-low-perf", similarity: 0.85, content: "Low Performance Content" }, // Higher similarity, but fails often
        { id: "item-new", similarity: 0.8, content: "New Content" }
    ];

    // Seed Performance Data
    console.log("Seeding performance data...");

    // 1. High Performer: 10 uses, 5 replies, 0 bounces -> Score > 0.6
    await prisma.knowledgePerformance.create({
        data: {
            knowledgeItemId: "item-high-perf",
            usageCount: 10,
            replies: 5,
            clicks: 2,
            bounces: 0,
            rewardScore: 8.0, // High reward total
            lastSuccessAt: new Date()
        }
    });

    // 2. Low Performer: 10 uses, 0 replies, 5 bounces
    await prisma.knowledgePerformance.create({
        data: {
            knowledgeItemId: "item-low-perf",
            usageCount: 10,
            replies: 0,
            clicks: 0,
            bounces: 5,
            rewardScore: -5.0, // Negative reward total
            lastSuccessAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        }
    });

    // 3. New Item: No performance data -> Default weight (0)

    // Fetch mocked data for the function
    const mockPerformanceData = await prisma.knowledgePerformance.findMany({});

    // Run Ranking
    console.log("Running Ranker...");
    // @ts-ignore
    const ranked = OutcomeRAGService.rankResults(items, mockPerformanceData);

    console.log("Ranked Results (Score = Usage * Reward):");
    // High: 10 * 0.704 (from previously seeded logic?) Wait, user logic is rewardScore * usageCount.
    // In seed, I set usageCount=10. I didn't set rewardScore explicitly in seed (default 0).
    // I need to update seed to set rewardScore.

    ranked.forEach((r: any, i: number) => console.log(`${i + 1}. ${r.id}`));

    // Assertions
    // High Perf Item should have highest score if rewardScore is > 0
    if (ranked[0].id !== "item-high-perf") throw new Error("High performer did not rank first");

    console.log("✅ Ranking Logic Verified!");

    await prisma.knowledgePerformance.deleteMany({});
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
