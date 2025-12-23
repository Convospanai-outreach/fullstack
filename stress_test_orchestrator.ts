import { prisma } from "./src/lib/db";
import { JobQueue } from "./src/lib/queue";

async function runStressTest() {
    console.log("🚀 Starting Campaign Orchestrator Stress Test...");

    // 1. Find or create a sample user & team
    let user = await prisma.user.findFirst();
    if (!user) {
        console.log("Creating dummy user...");
        user = await prisma.user.create({
            data: {
                email: "test@example.com",
                name: "Test User",
            }
        });
    }

    let team = await prisma.team.findFirst();
    if (!team) {
        console.log("Creating dummy team...");
        team = await prisma.team.create({
            data: {
                name: "Test Team",
                credits: 1000
            }
        });

        await prisma.teamMember.create({
            data: {
                teamId: team.id,
                email: user.email,
                userId: user.id,
                role: "owner",
                status: "active"
            }
        });
    }

    // 2. Find or create a sample campaign
    let campaign = await prisma.campaign.findFirst();
    if (!campaign) {
        console.log("Creating dummy campaign...");
        campaign = await prisma.campaign.create({
            data: {
                name: "Stress Test Campaign",
                status: "draft",
                teamId: team.id,
                ownerId: user.id
            }
        });
    }

    console.log(`📦 Enqueuing test job for campaign: ${campaign.name} (${campaign.id})`);

    // 3. Enqueue job
    const job = await JobQueue.enqueue("campaign_execution", {
        campaignId: campaign.id,
        userId: user.id
    });

    console.log(`✅ Job enqueued! Job ID: ${job.id}`);
    console.log(`\nNext steps:`);
    console.log(`1. Run the worker: npm run worker`);
    console.log(`2. Check the logs for job ${job.id}`);
    console.log(`3. Verify campaign status in DB.`);
}

runStressTest().catch(console.error);
