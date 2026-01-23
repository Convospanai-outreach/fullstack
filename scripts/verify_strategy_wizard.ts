
import { CampaignService } from "../src/lib/campaignService";
import { prisma } from "../src/lib/db";

async function verifyStrategyPersistence() {
    console.log("1. Creating Campaign via Service (simulating Wizard POST)...");

    // Mock Data from Wizard
    const wizardData = {
        name: "Test Strategy Campaign",
        targetCount: 100,
        teamId: "test-team-id", // We need a valid team ID, might need to fetch one first
        aiConfig: {
            executionMode: "saferun",
            tone: "Professional",
            context: "Testing SafeRun persistence"
        }
    };

    try {
        // 0. Get a valid team ID
        const team = await prisma.team.findFirst();
        if (!team) {
            console.error("No team found to test with.");
            return;
        }
        wizardData.teamId = team.id;

        // 1. Create
        const campaign = await CampaignService.createCampaign(wizardData);
        console.log(`   > Created Campaign ID: ${campaign.id}`);

        // 2. Verify
        console.log("2. Verifying Database Persistence...");
        const storedCampaign = await prisma.campaign.findUnique({
            where: { id: campaign.id }
        });

        if (!storedCampaign) {
            console.error("   > FAILED: Campaign not found in DB.");
            return;
        }

        const storedConfig = storedCampaign.aiConfig as any;
        console.log("   > Retreived aiConfig:", storedConfig);

        if (storedConfig?.executionMode === "saferun") {
            console.log("   > SUCCESS: executionMode 'saferun' persisted correctly.");
        } else {
            console.error("   > FAILED: executionMode mismatch or missing.");
        }

        // Cleanup
        await prisma.campaign.delete({ where: { id: campaign.id } });
        console.log("3. Cleanup complete.");

    } catch (e) {
        console.error("Verification Failed:", e);
    }
}

verifyStrategyPersistence();
