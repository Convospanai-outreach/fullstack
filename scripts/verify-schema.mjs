// Quick schema verification script
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySchema() {
    console.log("🔍 Verifying Database Schema...\n");

    try {
        // Test ClientError table exists
        const count = await prisma.clientError.count();
        console.log("✅ ClientError table exists");
        console.log(`   Current records: ${count}\n`);

        // Test other critical tables
        const tables = [
            { name: 'User', model: prisma.user },
            { name: 'Team', model: prisma.team },
            { name: 'Lead', model: prisma.lead },
            { name: 'EventStore', model: prisma.eventStore },
            { name: 'AgentTask', model: prisma.agentTask },
        ];

        for (const table of tables) {
            const count = await table.model.count();
            console.log(`✅ ${table.name} table: ${count} records`);
        }

        console.log("\n✅ All core tables verified!");

    } catch (error: any) {
        console.error("❌ Schema verification failed:", error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifySchema();
