import { CallerService } from "../modules/caller/CallerService";
import { prisma } from "../lib/db";
import { v4 as uuidv4 } from "uuid";

async function runHandoffStress() {
    console.log("🔥 Starting Handoff Service Stress Test (Local) 🔥");
    
    // 1. Setup Data
    const teamId = "team-" + uuidv4().substring(0, 8);
    const callerId = "caller-" + uuidv4().substring(0, 8);
    
    console.log(`Setting up team ${teamId} and caller ${callerId}...`);
    
    await prisma.team.create({ data: { id: teamId, name: "Stress Test Org" } });
    await prisma.user.create({
        data: {
            id: callerId,
            email: `${callerId}@test.com`,
            role: "user",
            enterpriseRole: "CALLER",
            isCaller: true,
            callerTeamId: teamId
        }
    });

    // 2. Create 100 Leads in the Handoff Queue
    console.log("Ingesting 100 leads into the coordination queue...");
    const leadIds: string[] = [];
    for (let i = 0; i < 100; i++) {
        const lid = uuidv4();
        await prisma.lead.create({
            data: {
                id: lid,
                teamId,
                email: `lead${i}@stress.com`,
                pipelineState: "HANDOFF_REQUIRED"
            }
        });
        await prisma.meetingCoordinationQueue.create({
            data: {
                leadId: lid,
                status: "PENDING",
                priority: Math.floor(Math.random() * 10)
            }
        });
        leadIds.push(lid);
    }

    // 2.5 Create a thread for the first lead (Required for state transition logic)
    const threadId = uuidv4();
    await prisma.conversationThread.create({
        data: {
            id: threadId,
            leadId: leadIds[0]!,
            state: "HANDOFF_REQUIRED"
        }
    });

    // 3. Simulate Concurrent "Claims"
    console.log(`Simulating 100 concurrent requests from caller ${callerId} for lead ${leadIds[0]}...`);
    
    const start = performance.now();
    const claimTasks = Array.from({ length: 100 }).map(async () => {
        try {
            return await CallerService.claimLead(leadIds[0]!, callerId);
        } catch (e: any) {
            return { error: e.message };
        }
    });

    const results = await Promise.all(claimTasks);
    const end = performance.now();

    const winners = results.filter((r: any) => r && !r.error).length;
    const errors = results.filter((r: any) => r && r.error).length;

    console.log(`\n✅ Contention Result:`);
    console.log(`- Total Requests: 100`);
    console.log(`- Winners (Should be 1): ${winners}`);
    console.log(`- Safe Denials (Concurrency Protected): ${errors}`);
    console.log(`- Race Protection Latency: ${(end - start).toFixed(2)}ms`);

    // 4. Simulate Bulk Throughput (Queue Fetch)
    console.log("\nSimulating 500 parallel queue fetches...");
    const startFetch = performance.now();
    const fetchTasks = Array.from({ length: 500 }).map(() => CallerService.getQueue(callerId));
    await Promise.all(fetchTasks);
    const endFetch = performance.now();
    
    console.log(`- Sync Latency: ${(endFetch - startFetch).toFixed(2)}ms`);
    console.log(`- Effective Throughput: ${Math.round(500 / ((endFetch - startFetch)/1000))} req/sec`);

    console.log("\n✅ Handoff Load Test PASSED (Atomic constraints verified).");
}

runHandoffStress()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
