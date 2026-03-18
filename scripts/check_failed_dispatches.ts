import { prisma } from "@/lib/db";

async function main() {
    const failed = await prisma.job.count({
        where: { status: "failed" }
    });
    console.log(`failed jobs=${failed}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
