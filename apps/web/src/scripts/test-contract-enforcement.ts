import { ContractResolver } from "../modules/contract/contractResolver";
import { KillSwitch } from "../modules/contract/killSwitch";

import { prisma } from "../lib/db";

async function main() {
    console.log("🔒 Starting Contract Enforcement Test...");

    // 1. Create a Fake Team with restrictive contract
    const team = await prisma.team.create({
        data: { name: "Contract Test Team" }
    });
    console.log(`Created Team: ${team.id}`);

    try {
        // 2. Set strict contract
        await prisma.contractProfile.create({
            data: {
                teamId: team.id,
                contractStatus: "ACTIVE",
                allowedChannels: ["EMAIL"], // LinkedIn NOT allowed
                allowedCapabilityLayers: ["CORE"], // GOVERNED_AI NOT allowed
                aiUsageLimit: 5, // Tiny Limit
                conversationThreadLimit: 5
            }
        });

        // 3. Test: AI Block (Should Fail)
        console.log("\n🧪 Test 1: Testing Restricted AI Capability...");
        try {
            await ContractResolver.resolveOrThrow(team.id, "GOVERNED_AI");
            console.error("❌ FAILED: Should have blocked GOVERNED_AI");
        } catch (e: any) {
            console.log("✅ PASSED: Blocked with error:", e.message);
        }

        // 4. Test: LinkedIn Block (Should Fail)
        console.log("\n🧪 Test 2: Testing Restricted Channel (LinkedIn)...");
        try {
            await ContractResolver.resolveOrThrow(team.id, "ADVANCED_OPS", "LINKEDIN");
            console.error("❌ FAILED: Should have blocked LINKEDIN");
        } catch (e: any) {
            console.log("✅ PASSED: Blocked with error:", e.message);
        }

        // 5. Test: Kill Switch
        console.log("\n🧪 Test 3: Testing Kill Switch...");
        await prisma.contractProfile.update({
            where: { teamId: team.id },
            data: { contractStatus: "SUSPENDED" }
        });

        try {
            await KillSwitch.verifyOrDie(team.id, "ALL");
            console.error("❌ FAILED: Should have triggered Kill Switch");
        } catch (e: any) {
            console.log("✅ PASSED: Killed with error:", e.message);
        }

    } catch (err) {
        console.error("Test Harness Fail:", err);
    } finally {
        // Cleanup
        await prisma.contractProfile.delete({ where: { teamId: team.id } });
        await prisma.team.delete({ where: { id: team.id } });
        console.log("\nCleanup Complete.");
    }
}

main();
