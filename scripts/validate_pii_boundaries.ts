import { prisma } from "@/lib/db";

async function main() {
    const policies = await prisma.organizationPolicy.findMany({
        select: { organizationId: true, productMode: true, executionMode: true }
    });
    for (const p of policies) {
        if (p.productMode === "ENTERPRISE_CORE" && p.executionMode === "saas_only") {
            console.warn(`[pii] org=${p.organizationId} core policy but saas_only mode`);
        }
    }
    console.log("PII boundary validation complete");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
