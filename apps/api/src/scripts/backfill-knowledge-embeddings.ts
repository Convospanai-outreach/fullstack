/**
 * One-off backfill: generates and stores embeddings for every KnowledgeItem
 * and AgentMemory row created before real vector search was wired up (they
 * were ingested with embedding left NULL, and stay lexical-search-only
 * until they get one). Rate-limit-friendly - small batches, short delay
 * between calls.
 *
 * embedding is an Unsupported("vector(1536)") column, so both the
 * NULL-selection and the write use raw SQL - Prisma Client can't filter or
 * set it through the normal typed API.
 *
 * Run: npx tsx src/scripts/backfill-knowledge-embeddings.ts
 */
import { prisma } from "../lib/db";
import { aiService } from "../lib/aiService";
import { toVectorLiteral } from "../lib/ai/vectorLiteral";

const BATCH_SIZE = 20;
const DELAY_MS = 200;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillKnowledgeItems() {
    let processed = 0;
    let embedded = 0;
    let failed = 0;
    const skipIds: string[] = [];

    for (;;) {
        const items = await prisma.$queryRawUnsafe<Array<{ id: string; content: string; teamId: string }>>(
            `SELECT ki.id, ki.content, kb."teamId"
             FROM "KnowledgeItem" ki
             JOIN "KnowledgeBase" kb ON ki."knowledgeBaseId" = kb.id
             WHERE ki.embedding IS NULL AND ki.id NOT IN (${skipIds.map((_, i) => `$${i + 2}`).join(",") || "''"})
             LIMIT $1`,
            BATCH_SIZE,
            ...skipIds
        );
        if (items.length === 0) break;

        for (const item of items) {
            processed++;
            try {
                const embedding = await aiService.getRagEmbedding(item.content, item.teamId);
                await prisma.$executeRawUnsafe(
                    `UPDATE "KnowledgeItem" SET embedding = $1::vector WHERE id = $2`,
                    toVectorLiteral(embedding),
                    item.id
                );
                embedded++;
            } catch (error: any) {
                failed++;
                skipIds.push(item.id);
                console.error(`  FAIL  KnowledgeItem ${item.id}: ${error?.message ?? error}`);
            }
            await sleep(DELAY_MS);
        }
    }

    console.log(`KnowledgeItem backfill done. processed=${processed} embedded=${embedded} failed=${failed}`);
    return failed;
}

async function backfillAgentMemories() {
    let processed = 0;
    let embedded = 0;
    let failed = 0;
    const skipIds: string[] = [];

    for (;;) {
        const memories = await prisma.$queryRawUnsafe<Array<{ id: string; key: string; value: string; teamId: string }>>(
            `SELECT id, key, value, "teamId"
             FROM "AgentMemory"
             WHERE embedding IS NULL AND id NOT IN (${skipIds.map((_, i) => `$${i + 2}`).join(",") || "''"})
             LIMIT $1`,
            BATCH_SIZE,
            ...skipIds
        );
        if (memories.length === 0) break;

        for (const memory of memories) {
            processed++;
            try {
                const embedding = await aiService.getRagEmbedding(`${memory.key}: ${memory.value}`, memory.teamId);
                await prisma.$executeRawUnsafe(
                    `UPDATE "AgentMemory" SET embedding = $1::vector WHERE id = $2`,
                    toVectorLiteral(embedding),
                    memory.id
                );
                embedded++;
            } catch (error: any) {
                failed++;
                skipIds.push(memory.id);
                console.error(`  FAIL  AgentMemory ${memory.id}: ${error?.message ?? error}`);
            }
            await sleep(DELAY_MS);
        }
    }

    console.log(`AgentMemory backfill done. processed=${processed} embedded=${embedded} failed=${failed}`);
    return failed;
}

async function main() {
    const knowledgeFailures = await backfillKnowledgeItems();
    const memoryFailures = await backfillAgentMemories();
    if (knowledgeFailures > 0 || memoryFailures > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error("Backfill script crashed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
