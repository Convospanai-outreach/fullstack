
import { SentinelService } from "../src/modules/audit/SentinelService";
import { browserManager } from "../src/modules/scraper-bridge/service/browserManager";
import { AgentExecutor, AgentState } from "../src/modules/agent/core/AgentExecutor";
import { prisma } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

async function setupMockData() {
    console.log("--- Provisioning Mock Data ---");
    // Ensure "SYSTEM" team exists for audit logs
    await prisma.team.upsert({
        where: { id: "SYSTEM" },
        update: {},
        create: {
            id: "SYSTEM",
            name: "System Operations"
        }
    });

    await prisma.team.upsert({
        where: { id: "test-team" },
        update: {},
        create: {
            id: "test-team",
            name: "Test Team"
        }
    });
}

async function testSentinel() {
    console.log("\n--- Testing Sentinel Semantic Judge ---");

    const validPayload = {
        title: "Security Update for 2024",
        source_url: "https://example.ae/ae/security",
        region_id: "UAE",
        content: "We have updated our protocols to ensure DPI compliance across all sectors."
    };

    const junkPayload = {
        title: "Testing junk",
        source_url: "https://example.com/junk",
        region_id: "GLOBAL",
        content: "asdfasdf asdfasdf 123123123 !!!!"
    };

    const metrics = { latency: 100, statusCode: 200, proxy_used: true };

    const validReport = await SentinelService.evaluate(validPayload, metrics);
    console.log("Valid Report Status:", validReport.status);

    const junkReport = await SentinelService.evaluate(junkPayload, metrics);
    console.log("Junk Report Status:", junkReport.status);
    console.log("Junk Report Logs:", junkReport.logs);
}

async function testBrowserConcurrency() {
    console.log("\n--- Testing Browser Concurrency Cap ---");
    const ids = ["1", "2", "3", "4", "5", "6"];
    const promises = ids.map(id => browserManager.newPage(id).catch(e => e.message));

    const results = await Promise.all(promises);
    results.forEach((res, i) => {
        console.log(`Page ${i + 1}:`, typeof res === 'string' ? `❌ ${res}` : "✅ Page Created");
    });

    await browserManager.close();
}

async function testAgentIdentity() {
    console.log("\n--- Testing Agent Identity Lock ---");

    // Create a mock task
    const task = await prisma.agentTask.create({
        data: {
            teamId: "test-team",
            goal: "Verification Task",
            status: AgentState.DATA_INGESTION, // Move to next state
            context: {}
        }
    });

    console.log(`Created Task ${task.id}. Triggering step...`);

    // In this simulation, we assume HardwareService will be called.
    // We can't easily disconnect a physical device here, but we can check if it throws 
    // when our simulated Edge Node (if running) is mismatching.

    try {
        const nextState = await (new AgentExecutor()).step(task.id);
        console.log("Next State:", nextState);
    } catch (e: any) {
        console.log("Identity Lock caught error:", e.message);
    }
}

async function runAllTests() {
    try {
        process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5433/craftmyfunnel?schema=public";
        console.log("DATABASE_URL (Forced IPv4):", process.env.DATABASE_URL);
        await setupMockData();
        await testSentinel();
        await testBrowserConcurrency();
        await testAgentIdentity();
    } catch (e) {
        console.error("Test Suit Failed:", e);
    } finally {
        process.exit(0);
    }
}

runAllTests();
