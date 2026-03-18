import { prisma } from "@/lib/db";

async function main() {
    const jobs = await prisma.job.findMany({
        where: { status: { in: ["pending", "processing", "completed", "dead_letter"] } },
        select: { id: true, status: true }
    });
    if (jobs.length) {
        console.log(`legacy status jobs=${jobs.length}`);
    } else {
        console.log("no legacy statuses found");
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
