import { prisma } from "@/lib/db";

async function main() {
    const policies = await prisma.organizationPolicy.findMany({
        select: { organizationId: true, executionMode: true }
    });
    for (const p of policies) {
        if (!p.executionMode) {
            console.warn(`[compat] org=${p.organizationId} missing executionMode`);
        }
    }
    console.log("OK runtime compatibility check complete");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
