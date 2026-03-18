import { prisma } from "@/lib/db";

async function main() {
    const dupes = await prisma.job.groupBy({
        by: ["idempotencyKey"],
        where: { idempotencyKey: { not: null } },
        _count: { id: true }
    });
    const offenders = dupes.filter(d => d._count.id > 1);
    console.log(`duplicate idempotency keys=${offenders.length}`);
    if (offenders.length) {
        process.exitCode = 2;
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
