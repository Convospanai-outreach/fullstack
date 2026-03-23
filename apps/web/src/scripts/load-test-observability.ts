import { ContractResolver } from "../modules/contract/contractResolver";
import { KillSwitch } from "../modules/contract/killSwitch";
import { prisma } from "../lib/db";

const CONCURRENT_USERS = 50;
const ACTIONS_PER_USER = 10;

async function main() {
    console.log(`🚀 Starting Load Test: ${CONCURRENT_USERS} users x ${ACTIONS_PER_USER} actions`);

    // 1. Setup: Create 10 Active, 10 Suspended, 10 Limited Teams
    console.log("Creating test teams...");
    const teams = [];

    for (let i = 0; i < 30; i++) {
        const team = await prisma.team.create({ data: { name: `LoadTest Team ${i}` } });
        teams.push(team);

        let status = "ACTIVE";
        let channel = ["EMAIL"];
        if (i >= 10 && i < 20) status = "SUSPENDED";
        if (i >= 20) { channel = []; } // Restricted

        await prisma.contractProfile.create({
            data: {
                teamId: team.id,
                contractStatus: status,
                allowedChannels: channel,
                allowedCapabilityLayers: ["CORE"], // Missing GOVERNED_AI
                aiUsageLimit: 1000
            }
        });
    }

    // 2. Simulate Load
    let totalDenials = 0;
    let totalSuccess = 0;

    const start = Date.now();

    const tasks = teams.map(async (team) => {
        for (let j = 0; j < ACTIONS_PER_USER; j++) {
            // Randomly try AI or LinkedIn
            try {
                if (Math.random() > 0.5) {
                    await ContractResolver.resolveOrThrow(team.id, "GOVERNED_AI");
                } else {
                    await ContractResolver.resolveOrThrow(team.id, "ADVANCED_OPS", "LINKEDIN");
                }
                totalSuccess++;
            } catch (e) {
                totalDenials++;
            }

            // Check Killswitch randomly
            if (Math.random() > 0.9) {
                try {
                    await KillSwitch.verifyOrDie(team.id, "ALL");
                } catch (e) { }
            }
        }
    });

    await Promise.all(tasks);

    const duration = (Date.now() - start) / 1000;
    console.log(`\n✅ Load Test Complete in ${duration}s`);
    console.log(`Throughput: ${(30 * ACTIONS_PER_USER) / duration} ops/sec`);
    console.log(`Total Denials Logged: ${totalDenials}`);
    console.log(`Total Success: ${totalSuccess}`);

    // Cleanup
    console.log("Cleaning up...");
    for (const t of teams) {
        await prisma.contractProfile.delete({ where: { teamId: t.id } });
        await prisma.team.delete({ where: { id: t.id } });
    }
}

main();
