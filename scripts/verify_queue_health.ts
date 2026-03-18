import { prisma } from "@/lib/db";

async function main() {
    const stuck = await prisma.job.count({
        where: { status: { in: ["running", "processing"] } }
    });
    console.log(`queue running count=${stuck}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
