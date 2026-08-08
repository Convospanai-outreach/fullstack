import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const envPaths = [".env", "apps/web/.env", "apps/api/.env", "apps/web/.env.local"];
for (const p of envPaths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
    }
}

if (!process.env["DATABASE_URL"]) {
    process.env["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:5432/craftmyfunnel?schema=public";
}

import { prisma } from "../apps/web/src/lib/db";

async function main() {
    console.log("=== Campaign completedCount Repair Script ===");

    const campaigns = await prisma.campaign.findMany({
        include: {
            _count: {
                select: { leadList: true },
            },
        },
    });

    console.log(`Found ${campaigns.length} campaigns to inspect.`);

    let fixedCount = 0;

    for (const campaign of campaigns) {
        const totalLeads = campaign._count.leadList || campaign.targetCount || 0;

        const actualCompletedLeads = await prisma.lead.count({
            where: {
                campaignId: campaign.id,
                status: { in: ["DRAFT_READY", "SENT", "COMPLETED", "REPLIED"] },
            },
        });

        const cappedCompleted = totalLeads > 0
            ? Math.min(actualCompletedLeads, totalLeads)
            : actualCompletedLeads;

        if (campaign.completedCount !== cappedCompleted) {
            console.log(
                `Campaign [${campaign.id}] "${campaign.name}": stored completedCount=${campaign.completedCount} -> repairing to ${cappedCompleted} (actual completed leads: ${actualCompletedLeads}, total leads: ${totalLeads})`
            );

            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { completedCount: cappedCompleted },
            });

            fixedCount++;
        } else {
            console.log(`Campaign [${campaign.id}] "${campaign.name}": completedCount=${campaign.completedCount} is accurate.`);
        }
    }

    console.log(`\nRepair complete. Fixed ${fixedCount} campaign records.`);
}

main()
    .catch((err) => {
        console.error("Error executing repair script:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
