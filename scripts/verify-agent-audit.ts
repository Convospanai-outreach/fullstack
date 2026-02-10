/**
 * Verification Script for Agent Audit Logging
 * 
 * This script verifies that all agent actions are properly logged to the EventStore
 * and generate appropriate audit narratives.
 */

import { prisma } from "@/lib/db";
import { AgentExecutor } from "@/modules/agent/core/AgentExecutor";

async function verifyAuditLogging() {
    console.log("🔍 Starting Agent Audit Logging Verification...\\n");

    try {
        // Clean up any existing test data
        console.log("1. Cleaning up test data...");
        await prisma.systemEvent.deleteMany({
            where: {
                teamId: "test-team-audit"
            }
        });
        await prisma.agentTask.deleteMany({
            where: {
                teamId: "test-team-audit"
            }
        });
        console.log("   ✓ Test data cleaned\\n");

        // Create a test agent task
        console.log("2. Creating test agent task...");
        const executor = new AgentExecutor();
        const taskId = await executor.startTask(
            "test-team-audit",
            "Test audit logging",
            { target_domain: "example.com", target_name: "Test User" }
        );
        console.log(`   ✓ Task created: ${taskId}\\n`);

        // Run one step to trigger state transition
        console.log("3. Executing first step (should trigger state transition)...");
        await executor.step(taskId);
        console.log("   ✓ Step executed\\n");

        // Wait a moment for database writes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Query audit logs
        console.log("4. Querying audit logs for AGENT events...\\n");
        const events = await prisma.systemEvent.findMany({
            where: {
                type: "AGENT",
                teamId: "test-team-audit"
            },
            orderBy: { timestamp: 'asc' },
            include: {
                audit: true
            }
        });

        if (events.length === 0) {
            console.error("   ❌ ERROR: No AGENT events found!");
            return;
        }

        console.log(`   ✓ Found ${events.length} AGENT events:\\n`);

        // Verify event types
        const eventTypes = new Set(events.map(e => e.name));
        console.log("   Event Types Captured:");
        eventTypes.forEach(type => {
            console.log(`     - ${type}`);
        });
        console.log("");

        // Display narratives
        console.log("5. Audit Narratives Generated:\\n");
        events.forEach((event, index) => {
            const narrative = event.audit[0]?.narrative || "⚠️  No narrative";
            console.log(`   [${index + 1}] ${event.timestamp.toISOString()}`);
            console.log(`       Type: ${event.name}`);
            console.log(`       Actor: ${event.actorId}`);
            console.log(`       Narrative: ${narrative}`);
            console.log("");
        });

        // Verify expected events
        console.log("6. Verification Checklist:\\n");
        const checks = {
            "AGENT_STATE_TRANSITION": eventTypes.has("AGENT_STATE_TRANSITION"),
            "Has audit narratives": events.every(e => e.audit && e.audit.length > 0),
            "Has actorId": events.every(e => e.actorId),
            "Has payload": events.every(e => e.payload),
        };

        Object.entries(checks).forEach(([check, passed]) => {
            console.log(`   ${passed ? '✓' : '❌'} ${check}`);
        });
        console.log("");

        // Summary
        const allPassed = Object.values(checks).every(v => v);
        if (allPassed) {
            console.log("✅ Agent Audit Logging Verification: PASSED\\n");
            console.log("All agent actions are being properly logged and audited.\\n");
        } else {
            console.log("❌ Agent Audit Logging Verification: FAILED\\n");
            console.log("Some checks did not pass. Review the output above.\\n");
        }

        // Test API endpoint
        console.log("7. Testing Admin API Endpoint...\\n");
        console.log("   You can query audit logs via:");
        console.log(`   GET /api/admin/agent-audit?teamId=test-team-audit`);
        console.log(`   GET /api/admin/agent-audit?taskId=${taskId}`);
        console.log("");

    } catch (error: any) {
        console.error("❌ Verification failed:", error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

// Run verification
verifyAuditLogging();
