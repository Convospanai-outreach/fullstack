
import { BullsEyeRAG } from '../src/modules/rag/service/BullsEyeRAG';
import { prisma } from '../src/lib/db';
import { mcpManager } from '../src/lib/mcp/McpManager';

async function verifyNetjanaIntegration() {
    console.log("🧪 Starting Netjana-TOON Integration Verification...");

    try {
        // 1. Setup Test Team
        const team = await prisma.team.findFirst() || await prisma.team.create({
            data: { name: "Test Team", credits: 1000 }
        });

        console.log(`[Test] Using Team: ${team.name} (${team.id})`);

        // 2. Initialize MCP (Ensure Netjana & Computer Use are registered)
        await mcpManager.initialize();

        // 3. Trigger Netjana Market Intelligence Sync
        // This will:
        // - Call Netjana MCP Tool
        // - Ingest "Mock" Signals (since Netjana URL is likely mock/env)
        // - Pass each signal through TOON (Sterilization + Compression)
        // - Attempt processSignal (CRM update via Computer Use MCP)
        console.log("\n[Test] Triggering Market Intelligence Sync for 'Cloud Security'...");
        await BullsEyeRAG.syncMarketIntelligence("Cloud Security", team.id);

        console.log("\n✅ Verification Flow Completed Successfully.");
        console.log("Check console logs above for TOON sterilization and MCP tool call markers.");

    } catch (error) {
        console.error("\n❌ Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyNetjanaIntegration();
